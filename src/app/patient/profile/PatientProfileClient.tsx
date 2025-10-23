'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import type { Patient, Observation } from '@/types/fhir';
import { ModernPatientProfile } from './PatientProfileModern';

// Extract contact information according to FHIR standard
// Handles both standard format (with system) and non-standard format (value only)
const extractContactInfo = (patient: Patient) => {
  const telecom = patient.telecom || [];

  // Try to find phone with system='phone', or fallback to first telecom entry
  const phone = telecom.find(t => t.system === 'phone')?.value
    || telecom.find(t => !t.system || t.system === 'phone')?.value
    || telecom[0]?.value;

  // Try to find email with system='email'
  const email = telecom.find(t => t.system === 'email')?.value;

  return { phone, email };
};


// Extract address according to FHIR standard
const extractAddress = (patient: Patient): string | null => {
  if (!patient.address || patient.address.length === 0) {
    return null;
  }

  const address = patient.address[0];
  const parts = [];

  if (address.line && address.line.length > 0) {
    parts.push(address.line.join(', '));
  }
  if (address.city) parts.push(address.city);
  if (address.state) parts.push(address.state);
  if (address.postalCode) parts.push(address.postalCode);

  return parts.length > 0 ? parts.join(', ') : null;
};

// Extract blood type from observations
const extractBloodType = (observations: Observation[]): string | null => {
  // Blood type LOINC codes: 882-1 (ABO group), 883-9 (ABO and Rh), 34532-2
  const bloodTypeObs = observations.find(obs =>
    obs.code?.coding?.some(c =>
      c.code === '882-1' || c.code === '883-9' || c.code === '34532-2'
    )
  );

  if (bloodTypeObs) {
    return bloodTypeObs.valueString ||
           bloodTypeObs.valueQuantity?.value?.toString() ||
           bloodTypeObs.code?.text ||
           null;
  }

  return null;
};

interface PatientProfileClientProps {
  patientName: string;
}

export default function PatientProfileClient({ patientName }: PatientProfileClientProps) {
  const { session } = useAuth();

  // Data states
  const [patient, setPatient] = useState<Patient | null>(null);
  const [conditions, setConditions] = useState<any[]>([]);
  const [medications, setMedicationRequests] = useState<any[]>([]);
  const [medicationDispenses, setMedicationDispenses] = useState<any[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [allergies, setAllergies] = useState<any[]>([]);
  const [procedures, setProcedures] = useState<any[]>([]);
  const [familyHistory, setFamilyHistory] = useState<any[]>([]);
  const [diagnosticReports, setDiagnosticReports] = useState<any[]>([]);
  const [serviceRequests, setServiceRequests] = useState<any[]>([]);
  const [coverage, setCoverage] = useState<any[]>([]);
  const [explanationOfBenefit, setExplanationOfBenefit] = useState<any[]>([]);
  const [encounters, setEncounters] = useState<any[]>([]);
  const [encounterPractitioners, setEncounterPractitioners] = useState<Record<string, any>>({});
  const [encounterConditions, setEncounterConditions] = useState<Record<string, any>>({});
  const [encounterAccounts, setEncounterAccounts] = useState<Record<string, any>>({});
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountOrganizations, setAccountOrganizations] = useState<Record<string, any>>({});

  // UI states
  const [loading, setLoading] = useState<Record<string, boolean>>({
    profile: false
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch all profile data in a single request
  const fetchProfileData = async () => {
    if (!session?.patient) return;

    setLoading({ profile: true });
    setErrors({});

    try {
      console.log('📋 Fetching complete profile data...');

      const response = await fetch('/api/fhir/patients/profile', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        throw new Error(`Failed to fetch profile data: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Profile data received:', data);

      // Set all state at once
      setPatient(data.patient);
      setConditions(data.conditions || []);
      setMedicationRequests(data.medications || []);
      setMedicationDispenses(data.medicationDispenses || []);
      setObservations(data.observations || []);
      setAllergies(data.allergies || []);
      setProcedures(data.procedures || []);
      setFamilyHistory(data.familyHistory || []);
      setDiagnosticReports(data.diagnosticReports || []);
      setServiceRequests(data.serviceRequests || []);
      setCoverage(data.coverage || []);
      setExplanationOfBenefit(data.explanationOfBenefit || []);

      // Handle encounters with related resources
      if (data.encounters) {
        setEncounters(data.encounters.encounters || []);
        setEncounterPractitioners(data.encounters.practitioners || {});
        setEncounterConditions(data.encounters.conditions || {});
        setEncounterAccounts(data.encounters.accounts || {});
        // Organizations are now included in the bundle
        setAccountOrganizations(data.encounters.organizations || {});
      }

      // Extract accounts from encounters
      const accountsMap: Record<string, any> = {};
      (data.encounters?.encounters || []).forEach((encounter: any) => {
        encounter.account?.forEach((accountRef: any) => {
          const accountId = accountRef.reference?.split('/').pop();
          if (accountId && data.encounters.accounts[accountId]) {
            accountsMap[accountId] = data.encounters.accounts[accountId];
          }
        });
      });
      setAccounts(Object.values(accountsMap));

    } catch (error) {
      console.error('❌ Error fetching profile data:', error);
      setErrors({
        profile: error instanceof Error ? error.message : 'Failed to load profile information'
      });
    } finally {
      setLoading({ profile: false });
    }
  };

  // Load all profile data when patient session changes
  useEffect(() => {
    if (!session?.patient) return;
    fetchProfileData();
  }, [session?.patient]);

  // Extract patient information for display
  const { phone, email } = patient ? extractContactInfo(patient) : { phone: null, email: null };
  const address = patient ? extractAddress(patient) : null;
  const bloodType = extractBloodType(observations);

  // Refetcher for manual refresh
  const refetchers = {
    patient: fetchProfileData,
    conditions: fetchProfileData,
    medications: fetchProfileData,
    medicationDispenses: fetchProfileData,
    allergies: fetchProfileData,
    procedures: fetchProfileData,
    familyHistory: fetchProfileData,
    observations: fetchProfileData,
    diagnosticReports: fetchProfileData,
    serviceRequests: fetchProfileData,
    encounters: fetchProfileData,
    coverage: fetchProfileData,
    explanationOfBenefit: fetchProfileData
  };

  return (
    <ModernPatientProfile
      patient={patient}
      conditions={conditions}
      medications={medications}
      medicationDispenses={medicationDispenses}
      observations={observations}
      allergies={allergies}
      procedures={procedures}
      familyHistory={familyHistory}
      encounters={encounters}
      diagnosticReports={diagnosticReports}
      serviceRequests={serviceRequests}
      coverage={coverage}
      explanationOfBenefit={explanationOfBenefit}
      accounts={accounts}
      accountOrganizations={accountOrganizations}
      encounterPractitioners={encounterPractitioners}
      encounterConditions={encounterConditions}
      encounterAccounts={encounterAccounts}
      phone={phone ?? undefined}
      email={email ?? undefined}
      address={address ?? undefined}
      bloodType={bloodType ?? undefined}
      loading={loading}
      errors={errors}
      refetchers={refetchers}
    />
  );
}
