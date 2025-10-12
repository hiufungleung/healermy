'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import type { Patient, Bundle, Condition, MedicationRequest, MedicationDispense, Observation, AllergyIntolerance, Procedure, FamilyMemberHistory, DiagnosticReport, ServiceRequest, Coverage, ExplanationOfBenefit, Organization, Account, Organization, Account } from '@/types/fhir';
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
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [medications, setMedicationRequests] = useState<MedicationRequest[]>([]);
  const [medicationDispenses, setMedicationDispenses] = useState<MedicationDispense[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [allergies, setAllergies] = useState<AllergyIntolerance[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [familyHistory, setFamilyHistory] = useState<FamilyMemberHistory[]>([]);
  const [diagnosticReports, setDiagnosticReports] = useState<DiagnosticReport[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [coverage, setCoverage] = useState<Coverage[]>([]);
  const [explanationOfBenefit, setExplanationOfBenefit] = useState<ExplanationOfBenefit[]>([]);
  const [encounters, setEncounters] = useState<any[]>([]);
  const [encounterPractitioners, setEncounterPractitioners] = useState<Record<string, any>>({});
  const [encounterConditions, setEncounterConditions] = useState<Record<string, any>>({});
  const [encounterAccounts, setEncounterAccounts] = useState<Record<string, any>>({});
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountOrganizations, setAccountOrganizations] = useState<Record<string, any>>({});

  // UI states
  const [loading, setLoading] = useState<Record<string, boolean>>({
    patient: false,
    conditions: false,
    medications: false,
    observations: false,
    allergies: false,
    procedures: false,
    familyHistory: false,
    encounters: false,
    diagnosticReports: false,
    serviceRequests: false,
    coverage: false,
    explanationOfBenefit: false
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch patient basic information
  const fetchPatientData = async () => {
    if (!session?.patient) return;

    setLoading(prev => ({ ...prev, patient: true }));
    setErrors(prev => ({ ...prev, patient: '' }));

    try {
      const response = await fetch(`/api/fhir/patients/${session.patient}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        throw new Error(`Failed to fetch patient data: ${response.status}`);
      }

      const patientData = await response.json();
      setPatient(patientData);
    } catch (error) {
      console.error('Error fetching patient data:', error);
      setErrors(prev => ({
        ...prev,
        patient: error instanceof Error ? error.message : 'Failed to load patient information'
      }));
    } finally {
      setLoading(prev => ({ ...prev, patient: false }));
    }
  };

  // Fetch patient conditions
  const fetchConditions = async () => {
    if (!session?.patient) return;

    console.log('🩺 Fetching conditions for patient:', session.patient);
    setLoading(prev => ({ ...prev, conditions: true }));
    setErrors(prev => ({ ...prev, conditions: '' }));

    try {
      const url = `/api/fhir/patients/${session.patient}/conditions`;
      console.log('📡 Conditions API URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });

      console.log('📡 Conditions API response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('🩺 Conditions data received:', data);

        let conditions: Condition[] = [];

        // Handle different response formats
        if (data.resourceType === 'Bundle' && data.entry) {
          // Standard FHIR Bundle format
          conditions = data.entry.map((entry: any) => entry.resource) || [];
        } else if (data.conditions && Array.isArray(data.conditions)) {
          // Custom format with direct conditions array
          conditions = data.conditions;
        } else if (Array.isArray(data)) {
          // Direct array format
          conditions = data;
        }

        console.log('🩺 Processed conditions:', conditions.length, conditions);
        setConditions(conditions);
      } else if (response.status === 404) {
        console.log('🩺 No conditions found (404)');
        setConditions([]);
      } else {
        throw new Error(`Failed to fetch conditions: ${response.status}`);
      }
    } catch (error) {
      console.error('Error fetching conditions:', error);
      setErrors(prev => ({
        ...prev,
        conditions: error instanceof Error ? error.message : 'Failed to load conditions'
      }));
    } finally {
      setLoading(prev => ({ ...prev, conditions: false }));
    }
  };

  // Fetch patient medications
  const fetchMedications = async () => {
    if (!session?.patient) return;

    console.log('💊 Fetching medications for patient:', session.patient);
    setLoading(prev => ({ ...prev, medications: true }));
    setErrors(prev => ({ ...prev, medications: '' }));

    try {
      const url = `/api/fhir/patients/${session.patient}/medications`;
      console.log('📡 Medications API URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });

      console.log('📡 Medications API response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('💊 Medications data received:', data);

        let medications: MedicationRequest[] = [];

        // Handle different response formats
        if (data.resourceType === 'Bundle' && data.entry) {
          // Standard FHIR Bundle format
          medications = data.entry.map((entry: any) => entry.resource) || [];
        } else if (data.medications && Array.isArray(data.medications)) {
          // Custom format with direct medications array
          medications = data.medications;
        } else if (Array.isArray(data)) {
          // Direct array format
          medications = data;
        }

        console.log('💊 Processed medications:', medications.length, medications);
        setMedicationRequests(medications);
      } else if (response.status === 404) {
        console.log('💊 No medications found (404)');
        setMedicationRequests([]);
      } else {
        throw new Error(`Failed to fetch medications: ${response.status}`);
      }
    } catch (error) {
      console.error('Error fetching medications:', error);
      setErrors(prev => ({
        ...prev,
        medications: error instanceof Error ? error.message : 'Failed to load medications'
      }));
    } finally {
      setLoading(prev => ({ ...prev, medications: false }));
    }
  };

  // Fetch patient medication dispenses (actual dispensing records)
  const fetchMedicationDispenses = async () => {
    if (!session?.patient) return;

    console.log('💊 Fetching medication dispenses for patient:', session.patient);
    setLoading(prev => ({ ...prev, medications: true }));

    try {
      const url = `/api/fhir/patients/${session.patient}/medication-dispenses`;
      console.log('📡 Medication Dispenses API URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });

      console.log('📡 Medication Dispenses API response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('💊 Medication dispenses data received:', data);

        let dispenses: MedicationDispense[] = [];

        // Handle different response formats
        if (data.resourceType === 'Bundle' && data.entry) {
          dispenses = data.entry.map((entry: any) => entry.resource) || [];
        } else if (Array.isArray(data)) {
          dispenses = data;
        }

        console.log('💊 Processed medication dispenses:', dispenses.length, dispenses);
        setMedicationDispenses(dispenses);
      } else if (response.status === 404) {
        console.log('💊 No medication dispenses found (404)');
        setMedicationDispenses([]);
      }
    } catch (error) {
      console.error('Error fetching medication dispenses:', error);
      // Don't set error state here, as it's supplementary data
    } finally {
      setLoading(prev => ({ ...prev, medications: false }));
    }
  };

  // Load data when patient session changes
  useEffect(() => {
    if (!session?.patient) return;

    fetchPatientData();
    fetchConditions();
    fetchMedications();
    fetchMedicationDispenses();
    fetchAllergies();
    fetchProcedures();
    fetchFamilyHistory();
    fetchObservations();
    fetchDiagnosticReports();
    fetchServiceRequests();
    fetchEncounters();
    fetchCoverage();
    fetchExplanationOfBenefit();
  }, [session?.patient]);

  // Fetch patient allergies
  const fetchAllergies = async () => {
    if (!session?.patient) return;

    console.log('🚨 Fetching allergies for patient:', session.patient);
    setLoading(prev => ({ ...prev, allergies: true }));
    setErrors(prev => ({ ...prev, allergies: '' }));

    try {
      const apiUrl = `/api/fhir/patients/${session.patient}/allergies`;
      console.log('📡 Allergies API URL:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'GET',
        credentials: 'include',
      });

      console.log('📡 Allergies API response status:', response.status);

      if (response.ok) {
        const bundle: Bundle<AllergyIntolerance> = await response.json();
        console.log('🚨 Allergies data received:', bundle);
        const allergiesData = bundle.entry?.map(entry => entry.resource) || [];

        // Filter out "No known allergies" entries (SNOMED code 716186003)
        const realAllergies = allergiesData.filter(allergy => {
          const snomedCode = allergy.code?.coding?.find(c => c.system === 'http://snomed.info/sct')?.code;
          return snomedCode !== '716186003'; // Exclude "No known allergies"
        });

        console.log('🚨 Processed allergies:', realAllergies.length, '(filtered from', allergiesData.length, 'total)');
        setAllergies(realAllergies);
      } else if (response.status === 404) {
        console.log('🚨 No allergies found (404), setting empty array');
        setAllergies([]);
      } else {
        throw new Error(`Failed to fetch allergies: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Error fetching allergies:', error);
      setErrors(prev => ({
        ...prev,
        allergies: error instanceof Error ? error.message : 'Failed to load allergies'
      }));
    } finally {
      setLoading(prev => ({ ...prev, allergies: false }));
    }
  };


  // Fetch patient procedures (includes practitioners and conditions via _include)
  const fetchProcedures = async () => {
    if (!session?.patient) return;

    console.log('🔬 Fetching procedures for patient:', session.patient);
    setLoading(prev => ({ ...prev, procedures: true }));
    setErrors(prev => ({ ...prev, procedures: '' }));

    try {
      const url = `/api/fhir/patients/${session.patient}/procedures`;
      console.log('📡 Procedures API URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });

      console.log('📡 Procedures API response status:', response.status);

      if (response.ok) {
        const bundle: Bundle<Procedure> = await response.json();
        console.log('📋 Procedures data received:', bundle);

        // Separate Procedures, Practitioners, and Conditions from the bundle
        const procedureEntries: Procedure[] = [];
        const practitionerMap: Record<string, any> = {};
        const conditionMap: Record<string, any> = {};

        bundle.entry?.forEach(entry => {
          if (entry.resource.resourceType === 'Procedure') {
            procedureEntries.push(entry.resource as Procedure);
          } else if (entry.resource.resourceType === 'Practitioner') {
            // Store practitioner by ID for easy lookup
            practitionerMap[entry.resource.id] = entry.resource;
          } else if (entry.resource.resourceType === 'Condition') {
            // Store condition by ID for easy lookup
            conditionMap[entry.resource.id] = entry.resource;
          }
        });

        console.log('📋 Processed procedures:', procedureEntries.length);
        console.log('👨‍⚕️ Practitioners found:', Object.keys(practitionerMap).length);
        console.log('🩺 Conditions found:', Object.keys(conditionMap).length);

        setProcedures(procedureEntries);
      } else if (response.status === 404) {
        console.log('📋 No procedures found (404)');
        setProcedures([]);
      } else {
        throw new Error(`Failed to fetch procedures: ${response.status}`);
      }
    } catch (error) {
      console.error('Error fetching procedures:', error);
      setErrors(prev => ({
        ...prev,
        procedures: error instanceof Error ? error.message : 'Failed to load procedures'
      }));
    } finally {
      setLoading(prev => ({ ...prev, procedures: false }));
    }
  };

  // Fetch patient family history
  const fetchFamilyHistory = async () => {
    if (!session?.patient) return;

    setLoading(prev => ({ ...prev, familyHistory: true }));
    setErrors(prev => ({ ...prev, familyHistory: '' }));

    try {
      const response = await fetch(`/api/fhir/patients/${session.patient}/family-history`, {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const bundle: Bundle<FamilyMemberHistory> = await response.json();
        setFamilyHistory(bundle.entry?.map(entry => entry.resource) || []);
      } else if (response.status === 404) {
        setFamilyHistory([]);
      } else {
        throw new Error(`Failed to fetch family history: ${response.status}`);
      }
    } catch (error) {
      console.error('Error fetching family history:', error);
      setErrors(prev => ({
        ...prev,
        familyHistory: error instanceof Error ? error.message : 'Failed to load family history'
      }));
    } finally {
      setLoading(prev => ({ ...prev, familyHistory: false }));
    }
  };

  // Fetch patient observations (test results, vitals, etc.)
  const fetchObservations = async () => {
    if (!session?.patient) return;

    console.log('🧪 Fetching observations for patient:', session.patient);
    setLoading(prev => ({ ...prev, observations: true }));
    setErrors(prev => ({ ...prev, observations: '' }));

    try {
      const url = `/api/fhir/patients/${session.patient}/observations`;
      console.log('📡 Observations API URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });

      console.log('📡 Observations API response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('🧪 Observations data received:', data);

        let observations: Observation[] = [];

        // Handle different response formats
        if (data.resourceType === 'Bundle' && data.entry) {
          observations = data.entry.map((entry: any) => entry.resource) || [];
        } else if (data.observations && Array.isArray(data.observations)) {
          observations = data.observations;
        } else if (Array.isArray(data)) {
          observations = data;
        }

        console.log('🧪 Processed observations:', observations.length, observations);
        setObservations(observations);
      } else if (response.status === 404) {
        console.log('🧪 No observations found (404)');
        setObservations([]);
      } else {
        throw new Error(`Failed to fetch observations: ${response.status}`);
      }
    } catch (error) {
      console.error('Error fetching observations:', error);
      setErrors(prev => ({
        ...prev,
        observations: error instanceof Error ? error.message : 'Failed to load observations'
      }));
    } finally {
      setLoading(prev => ({ ...prev, observations: false }));
    }
  };

  // Fetch patient diagnostic reports
  const fetchDiagnosticReports = async () => {
    if (!session?.patient) return;

    console.log('📋 Fetching diagnostic reports for patient:', session.patient);
    setLoading(prev => ({ ...prev, diagnosticReports: true }));
    setErrors(prev => ({ ...prev, diagnosticReports: '' }));

    try {
      const url = `/api/fhir/patients/${session.patient}/diagnostic-reports`;
      console.log('📡 Diagnostic Reports API URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });

      console.log('📡 Diagnostic Reports API response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('📋 Diagnostic reports data received:', data);

        let diagnosticReports: DiagnosticReport[] = [];

        // Handle different response formats
        if (data.resourceType === 'Bundle' && data.entry) {
          diagnosticReports = data.entry.map((entry: any) => entry.resource) || [];
        } else if (data.diagnosticReports && Array.isArray(data.diagnosticReports)) {
          diagnosticReports = data.diagnosticReports;
        } else if (Array.isArray(data)) {
          diagnosticReports = data;
        }

        console.log('📋 Processed diagnostic reports:', diagnosticReports.length, diagnosticReports);
        setDiagnosticReports(diagnosticReports);
      } else if (response.status === 404) {
        console.log('📋 No diagnostic reports found (404)');
        setDiagnosticReports([]);
      } else {
        throw new Error(`Failed to fetch diagnostic reports: ${response.status}`);
      }
    } catch (error) {
      console.error('Error fetching diagnostic reports:', error);
      setErrors(prev => ({
        ...prev,
        diagnosticReports: error instanceof Error ? error.message : 'Failed to load diagnostic reports'
      }));
    } finally {
      setLoading(prev => ({ ...prev, diagnosticReports: false }));
    }
  };

  // Fetch patient service requests (lab orders, etc.)
  const fetchServiceRequests = async () => {
    if (!session?.patient) return;

    console.log('📝 Fetching service requests for patient:', session.patient);
    setLoading(prev => ({ ...prev, serviceRequests: true }));
    setErrors(prev => ({ ...prev, serviceRequests: '' }));

    try {
      const url = `/api/fhir/patients/${session.patient}/service-requests`;
      console.log('📡 Service Requests API URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });

      console.log('📡 Service Requests API response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('📝 Service requests data received:', data);

        let serviceRequests: ServiceRequest[] = [];

        // Handle different response formats
        if (data.resourceType === 'Bundle' && data.entry) {
          serviceRequests = data.entry.map((entry: any) => entry.resource) || [];
        } else if (data.serviceRequests && Array.isArray(data.serviceRequests)) {
          serviceRequests = data.serviceRequests;
        } else if (Array.isArray(data)) {
          serviceRequests = data;
        }

        console.log('📝 Processed service requests:', serviceRequests.length, serviceRequests);
        setServiceRequests(serviceRequests);
      } else if (response.status === 404) {
        console.log('📝 No service requests found (404)');
        setServiceRequests([]);
      } else {
        throw new Error(`Failed to fetch service requests: ${response.status}`);
      }
    } catch (error) {
      console.error('Error fetching service requests:', error);
      setErrors(prev => ({
        ...prev,
        serviceRequests: error instanceof Error ? error.message : 'Failed to load service requests'
      }));
    } finally {
      setLoading(prev => ({ ...prev, serviceRequests: false }));
    }
  };

  // Fetch patient coverage (insurance information)
  const fetchCoverage = async () => {
    if (!session?.patient) return;

    console.log('🏥 Fetching coverage for patient:', session.patient);
    setLoading(prev => ({ ...prev, coverage: true }));
    setErrors(prev => ({ ...prev, coverage: '' }));

    try {
      const url = `/api/fhir/patients/${session.patient}/coverage`;
      console.log('📡 Coverage API URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });

      console.log('📡 Coverage API response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('🏥 Coverage data received:', data);

        let coverage: Coverage[] = [];

        // Handle different response formats
        if (data.resourceType === 'Bundle' && data.entry) {
          // Standard FHIR Bundle format
          coverage = data.entry.map((entry: any) => entry.resource) || [];
        } else if (data.coverage && Array.isArray(data.coverage)) {
          // Custom format with direct coverage array
          coverage = data.coverage;
        } else if (Array.isArray(data)) {
          // Direct array format
          coverage = data;
        }

        console.log('🏥 Processed coverage:', coverage.length, coverage);
        setCoverage(coverage);
      } else if (response.status === 404) {
        console.log('🏥 No coverage found (404)');
        setCoverage([]);
      } else {
        throw new Error(`Failed to fetch coverage: ${response.status}`);
      }
    } catch (error) {
      console.error('Error fetching coverage:', error);
      setErrors(prev => ({
        ...prev,
        coverage: error instanceof Error ? error.message : 'Failed to load coverage'
      }));
    } finally {
      setLoading(prev => ({ ...prev, coverage: false }));
    }
  };

  // Fetch patient explanation of benefit records
  const fetchExplanationOfBenefit = async () => {
    if (!session?.patient) return;

    console.log('💰 Fetching explanation of benefit for patient:', session.patient);
    setLoading(prev => ({ ...prev, explanationOfBenefit: true }));
    setErrors(prev => ({ ...prev, explanationOfBenefit: '' }));

    try {
      const url = `/api/fhir/patients/${session.patient}/explanation-of-benefit`;
      console.log('📡 EOB API URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });

      console.log('📡 EOB API response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('💰 EOB data received:', data);

        let eobs: ExplanationOfBenefit[] = [];

        // Handle FHIR Bundle format
        if (data.resourceType === 'Bundle' && data.entry) {
          eobs = data.entry.map((entry: any) => entry.resource) || [];
        } else if (Array.isArray(data)) {
          eobs = data;
        }

        console.log('💰 Processed EOB records:', eobs.length);
        setExplanationOfBenefit(eobs);
      } else if (response.status === 404) {
        console.log('💰 No EOB records found (404)');
        setExplanationOfBenefit([]);
      } else {
        throw new Error(`Failed to fetch EOB: ${response.status}`);
      }
    } catch (error) {
      console.error('Error fetching explanation of benefit:', error);
      setErrors(prev => ({
        ...prev,
        explanationOfBenefit: error instanceof Error ? error.message : 'Failed to load claim information'
      }));
    } finally {
      setLoading(prev => ({ ...prev, explanationOfBenefit: false }));
    }
  };

  // Fetch encounters and related data
  const fetchEncounters = async () => {
    if (!session?.patient) return;

    console.log('🏥 Fetching encounters for patient:', session.patient);
    setLoading(prev => ({ ...prev, encounters: true }));
    try {
      const response = await fetch(`/api/fhir/patients/${session.patient}/encounters`, {
        method: 'GET',
        credentials: 'include',
      });

      console.log('📡 Encounters API response status:', response.status);

      if (!response.ok) {
        throw new Error(`Failed to fetch encounters: ${response.status}`);
      }

      const data = await response.json();
      console.log('🏥 Encounters data received:', {
        encountersCount: data.encounters?.length || 0,
        practitionersCount: Object.keys(data.practitioners || {}).length,
        conditionsCount: Object.keys(data.conditions || {}).length,
        accountsCount: Object.keys(data.accounts || {}).length
      });

      setEncounters(data.encounters || []);
      setEncounterPractitioners(data.practitioners || {});
      setEncounterConditions(data.conditions || {});
      setEncounterAccounts(data.accounts || {});

      // Extract unique accounts from encounters for insurance tab
      const accountsMap: Record<string, any> = {};
      data.encounters?.forEach((encounter: any) => {
        encounter.account?.forEach((accountRef: any) => {
          const accountId = accountRef.reference?.split('/').pop();
          if (accountId && data.accounts[accountId]) {
            accountsMap[accountId] = data.accounts[accountId];
          }
        });
      });

      setAccounts(Object.values(accountsMap));
      console.log('📋 Accounts extracted:', Object.values(accountsMap).length);

      // Fetch organizations for accounts
      const orgsMap: Record<string, Organization> = {};
      for (const account of Object.values(accountsMap)) {
        const typedAccount = account as Account;
        const ownerId = typedAccount.owner?.reference?.split('/').pop();
        if (ownerId) {
          try {
            const orgResponse = await fetch(`/api/fhir/accounts/${typedAccount.id}`, {
              method: 'GET',
              credentials: 'include',
            });
            if (orgResponse.ok) {
              const orgData = await orgResponse.json();
              if (orgData.organization) {
                orgsMap[ownerId] = orgData.organization;
              }
            }
          } catch (error) {
            console.error(`Failed to fetch organization ${ownerId}:`, error);
          }
        }
      }
      setAccountOrganizations(orgsMap);
      console.log('🏢 Organizations fetched:', Object.keys(orgsMap).length);

    } catch (error) {
      console.error('Error fetching encounters:', error);
      setEncounters([]);
      setEncounterPractitioners({});
      setEncounterConditions({});
      setEncounterAccounts({});
      setAccounts([]);
      setAccountOrganizations({});
    } finally {
      setLoading(prev => ({ ...prev, encounters: false }));
    }
  };

  // Extract patient information for display
  const { phone, email } = patient ? extractContactInfo(patient) : { phone: null, email: null };
  const address = patient ? extractAddress(patient) : null;
  const bloodType = extractBloodType(observations);

  const refetchers = {
    patient: fetchPatientData,
    conditions: fetchConditions,
    medications: fetchMedications,
    medicationDispenses: fetchMedicationDispenses,
    allergies: fetchAllergies,
    procedures: fetchProcedures,
    familyHistory: fetchFamilyHistory,
    observations: fetchObservations,
    diagnosticReports: fetchDiagnosticReports,
    serviceRequests: fetchServiceRequests,
    encounters: fetchEncounters,
    coverage: fetchCoverage,
    explanationOfBenefit: fetchExplanationOfBenefit
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
