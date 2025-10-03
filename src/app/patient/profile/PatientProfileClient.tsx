'use client';

import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/common/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { useAuth } from '@/components/auth/AuthProvider';
import type { Patient, Bundle, Condition, MedicationRequest, MedicationDispense, Observation, AllergyIntolerance, Procedure, FamilyMemberHistory, DiagnosticReport, ServiceRequest, Coverage, ExplanationOfBenefit } from '@/types/fhir';
import { HealthOverview } from '@/components/patient/HealthOverview';
import { InsuranceOverview } from '@/components/patient/InsuranceOverview';
import { EncountersOverview } from '@/components/patient/EncountersOverview';
import { PatientInfoBanner } from '@/components/patient/PatientInfoBanner';

// Extract patient name according to FHIR standard
const extractPatientName = (patient: Patient): string => {
  if (!patient.name || patient.name.length === 0) {
    return 'Unknown Patient';
  }

  const name = patient.name[0];

  // Use text if available (formatted name)
  if (name.text) {
    return name.text;
  }

  // Construct from given and family names
  const parts = [];
  if (name.given && name.given.length > 0) {
    parts.push(name.given.join(' '));
  }
  if (name.family) {
    parts.push(name.family);
  }

  return parts.length > 0 ? parts.join(' ') : 'Unknown Patient';
};

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

interface PatientProfileClientProps {
  patientName: string;
}

export default function PatientProfileClient({ patientName }: PatientProfileClientProps) {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<'personal' | 'medical' | 'insurance' | 'settings'>('personal');

  // Pagination states for conditions and medications
  const [showAllConditions, setShowAllConditions] = useState(false);
  const [showAllMedications, setShowAllMedications] = useState(false);
  // Pagination states for clinical results
  const [showAllObservations, setShowAllObservations] = useState(false);
  const [showAllDiagnosticReports, setShowAllDiagnosticReports] = useState(false);
  const [showAllServiceRequests, setShowAllServiceRequests] = useState(false);
  const [showAllFamilyHistory, setShowAllFamilyHistory] = useState(false);
  const INITIAL_DISPLAY_COUNT = 5;

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

  // Settings states
  const [allowReminders, setAllowReminders] = useState(true);
  const [shareWithDoctors, setShareWithDoctors] = useState(true);

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

  // Load data on component mount
  useEffect(() => {
    fetchPatientData();
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

  // Load medical data when medical tab is selected
  useEffect(() => {
    console.log('🔍 Medical tab effect triggered:', { activeTab, patientId: session?.patient });

    if (activeTab === 'medical' && session?.patient) {
      console.log('📊 Starting to fetch medical data for patient:', session.patient);
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
    }
  }, [activeTab, session?.patient]);

  // Load insurance data when insurance tab is selected
  useEffect(() => {
    console.log('🔍 Insurance tab effect triggered:', { activeTab, patientId: session?.patient });

    if (activeTab === 'insurance' && session?.patient) {
      console.log('🏥 Starting to fetch insurance data for patient:', session.patient);
      fetchCoverage();
      fetchExplanationOfBenefit();
      fetchEncounters();
    }
  }, [activeTab, session?.patient]);

  // Extract patient information for display
  const displayName = patient ? extractPatientName(patient) : patientName;
  const { phone, email } = patient ? extractContactInfo(patient) : { phone: null, email: null };
  const address = patient ? extractAddress(patient) : null;

  const renderPersonalInfo = () => (
    <div className="space-y-6">
      {/* Contact Information */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">Contact Information</h3>
        {loading.patient ? (
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-40"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-56"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-72"></div>
          </div>
        ) : errors.patient ? (
          <div className="text-red-600 text-sm">
            {errors.patient}
            <button
              onClick={fetchPatientData}
              className="ml-2 text-primary hover:underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-text-secondary">{email || 'No email provided'}</span>
            </div>

            <div className="flex items-center">
              <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span className="text-text-secondary">{phone || 'No phone provided'}</span>
            </div>

            <div className="flex items-start">
              <svg className="w-5 h-5 text-gray-400 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-text-secondary">{address || 'No address provided'}</span>
            </div>
          </div>
        )}
      </Card>
    </div>
  );

  const renderMedicalInfo = () => {
    return (
      <div className="space-y-6">
        {/* Health Overview - Top Priority Information */}
        <HealthOverview
          conditions={conditions}
          medications={medications}
          allergies={allergies}
          procedures={procedures}
          loading={{
            conditions: loading.conditions,
            medications: loading.medications,
            allergies: loading.allergies,
            procedures: loading.procedures
          }}
        />

        {/* Visit History - Encounters */}
        <EncountersOverview
          encounters={encounters}
          practitioners={encounterPractitioners}
          conditions={encounterConditions}
          accounts={encounterAccounts}
          procedures={procedures}
          loading={loading.encounters}
        />

        {/* Detailed Medical Records - Collapsible Sections */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-text-primary mb-4 border-b border-gray-200 pb-2">
          Detailed Medical Records
        </h2>

        {/* Allergies & Intolerances */}
        <Card className="mb-4" data-section="allergies">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center">
              <span className="text-red-500 mr-2">⚠️</span>
              Allergies & Intolerances
            </h3>
            {loading.allergies && (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            )}
          </div>

          {errors.allergies ? (
            <div className="text-red-600 text-sm mb-4">
              {errors.allergies}
              <button onClick={fetchAllergies} className="ml-2 text-primary hover:underline">
                Retry
              </button>
            </div>
          ) : allergies.length > 0 ? (
            <div className="space-y-3">
              {allergies.map((allergy, index) => (
                <div key={allergy.id || index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-red-800">
                      {allergy.code?.text || allergy.code?.coding?.[0]?.display || 'Unknown Allergen'}
                    </h4>
                    <div className="flex space-x-2">
                      {/* Clinical Status */}
                      {allergy.clinicalStatus?.coding?.[0]?.code && (
                        <Badge
                          variant={
                            allergy.clinicalStatus.coding[0].code === 'active' ? 'danger' :
                            allergy.clinicalStatus.coding[0].code === 'inactive' ? 'warning' :
                            'info'
                          }
                          size="sm"
                        >
                          {allergy.clinicalStatus.coding[0].code}
                        </Badge>
                      )}
                      {/* Verification Status */}
                      {allergy.verificationStatus?.coding?.[0]?.code && (
                        <Badge
                          variant={
                            allergy.verificationStatus.coding[0].code === 'confirmed' ? 'success' :
                            allergy.verificationStatus.coding[0].code === 'unconfirmed' ? 'warning' :
                            allergy.verificationStatus.coding[0].code === 'refuted' ? 'danger' :
                            'info'
                          }
                          size="sm"
                        >
                          {allergy.verificationStatus.coding[0].code}
                        </Badge>
                      )}
                      {/* Criticality */}
                      {allergy.criticality && (
                        <Badge
                          variant={allergy.criticality === 'high' ? 'danger' : allergy.criticality === 'low' ? 'warning' : 'info'}
                          size="sm"
                        >
                          criticality: {allergy.criticality}
                        </Badge>
                      )}
                      {/* Type */}
                      {allergy.type && (
                        <Badge variant="info" size="sm">
                          {allergy.type}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {allergy.category && allergy.category.length > 0 && (
                    <p className="text-sm text-red-700 mt-1">
                      Category: {allergy.category.join(', ')}
                    </p>
                  )}
                  {allergy.reaction && allergy.reaction.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-red-700">Reactions:</p>
                      {allergy.reaction.map((reaction: any, idx: number) => (
                        <div key={idx} className="text-sm text-red-600 ml-2">
                          {reaction.manifestation?.map((m: any) =>
                            m.text || m.coding?.[0]?.display
                          ).filter(Boolean).join(', ')}
                          {reaction.severity && ` (${reaction.severity})`}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : !loading.allergies ? (
            <p className="text-text-secondary">No known allergies or intolerances</p>
          ) : null}
        </Card>

        {/* Current Conditions */}
        <Card className="mb-4" data-section="conditions">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Current Conditions</h3>
            {loading.conditions && (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            )}
          </div>

          {errors.conditions ? (
            <div className="text-red-600 text-sm mb-4">
              {errors.conditions}
              <button onClick={fetchConditions} className="ml-2 text-primary hover:underline">
                Retry
              </button>
            </div>
          ) : conditions.length > 0 ? (
            <>
              <div className="space-y-3">
                {(showAllConditions ? conditions : conditions.slice(0, INITIAL_DISPLAY_COUNT)).map((condition, index) => (
                  <div key={condition.id || index} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium">
                          {condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown Condition'}
                        </h4>
                        {/* Show ICD code to differentiate similar conditions */}
                        {condition.code?.coding?.[0]?.code && (
                          <p className="text-xs text-text-secondary mt-1">
                            ICD-10: {condition.code.coding[0].code}
                            {condition.code.coding[0].code.endsWith('A') && ' (Initial encounter)'}
                            {condition.code.coding[0].code.endsWith('D') && ' (Subsequent encounter)'}
                            {condition.code.coding[0].code.endsWith('S') && ' (Sequela)'}
                          </p>
                        )}
                      </div>
                      {condition.clinicalStatus?.coding?.[0]?.code && (
                        <Badge
                          variant={condition.clinicalStatus.coding[0].code === 'active' ? 'warning' : 'info'}
                          size="sm"
                        >
                          {condition.clinicalStatus.coding[0].code}
                        </Badge>
                      )}
                    </div>
                    {/* Show available dates */}
                    <div className="text-xs text-text-secondary mt-2 space-y-1">
                      {(condition as any).recordedDate && (
                        <p className="flex items-center">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                          </svg>
                          Recorded: {new Date((condition as any).recordedDate).toLocaleDateString()}
                        </p>
                      )}
                      {(condition as any).onsetDateTime && (
                        <p className="flex items-center">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                          Onset: {new Date((condition as any).onsetDateTime).toLocaleDateString()}
                        </p>
                      )}
                      {(condition as any).meta?.lastUpdated && !((condition as any).recordedDate) && (
                        <p className="flex items-center text-gray-400">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                          Data updated: {new Date((condition as any).meta.lastUpdated).toLocaleDateString()}
                          <span className="ml-1">(not clinical date)</span>
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {conditions.length > INITIAL_DISPLAY_COUNT && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => setShowAllConditions(!showAllConditions)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
                  >
                    {showAllConditions ? (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                        Show Less
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        Show More ({conditions.length - INITIAL_DISPLAY_COUNT} more conditions)
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          ) : !loading.conditions ? (
            <p className="text-text-secondary">No current conditions recorded</p>
          ) : null}
        </Card>
      </div>

      {/* Medications Section */}
      <div className="mb-8" data-section="medications">
        <h2 className="text-xl font-bold text-text-primary mb-4 border-b border-gray-200 pb-2">
          Medications
        </h2>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Medication History</h3>
            {loading.medications && (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            )}
          </div>

          {errors.medications ? (
            <div className="text-red-600 text-sm mb-4">
              {errors.medications}
              <button onClick={fetchMedications} className="ml-2 text-primary hover:underline">
                Retry
              </button>
            </div>
          ) : medicationDispenses.length > 0 ? (
            <>
              {(() => {
                // Group dispenses by medication name
                const groupedMeds = medicationDispenses.reduce((acc, dispense) => {
                  const medName = dispense.medicationCodeableConcept?.text ||
                                 dispense.medicationCodeableConcept?.coding?.[0]?.display ||
                                 'Unknown Medication';
                  const medCode = dispense.medicationCodeableConcept?.coding?.[0]?.code || '';
                  const key = `${medName}_${medCode}`;

                  if (!acc[key]) {
                    acc[key] = {
                      name: medName,
                      code: medCode,
                      dispenses: []
                    };
                  }
                  acc[key].dispenses.push(dispense);
                  return acc;
                }, {} as Record<string, { name: string; code: string; dispenses: MedicationDispense[] }>);

                // Convert to array and sort by most recent dispense
                const medications = Object.values(groupedMeds).map(med => {
                  // Sort dispenses by date (newest first)
                  med.dispenses.sort((a, b) => {
                    const dateA = a.whenHandedOver ? new Date(a.whenHandedOver).getTime() : 0;
                    const dateB = b.whenHandedOver ? new Date(b.whenHandedOver).getTime() : 0;
                    return dateB - dateA;
                  });
                  return med;
                }).sort((a, b) => {
                  const dateA = a.dispenses[0]?.whenHandedOver ? new Date(a.dispenses[0].whenHandedOver).getTime() : 0;
                  const dateB = b.dispenses[0]?.whenHandedOver ? new Date(b.dispenses[0].whenHandedOver).getTime() : 0;
                  return dateB - dateA;
                });

                const displayedMeds = showAllMedications ? medications : medications.slice(0, INITIAL_DISPLAY_COUNT);

                return (
                  <>
                    <div className="space-y-4">
                      {displayedMeds.map((med, index) => {
                        const mostRecent = med.dispenses[0];
                        const totalDispenses = med.dispenses.length;

                        return (
                          <div key={`${med.code}_${index}`} className="group bg-white border border-gray-200 rounded-xl p-5 hover:border-green-300 hover:shadow-lg transition-all duration-200">
                            {/* Header */}
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <h4 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-green-700 transition-colors">
                                  {med.name}
                                </h4>
                                {med.code && (
                                  <p className="text-xs text-gray-400">RxNorm {med.code}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                                  {totalDispenses} {totalDispenses === 1 ? 'Dispense' : 'Dispenses'}
                                </span>
                                <Badge variant="info" size="sm">
                                  {mostRecent.status}
                                </Badge>
                              </div>
                            </div>

                            {/* Most Recent Dispense Info */}
                            <div className="mb-3 p-3 bg-green-50 rounded-lg border border-green-100">
                              <p className="text-xs font-semibold text-green-700 mb-2">Most Recent</p>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {mostRecent.whenHandedOver && (
                                  <div>
                                    <p className="text-xs text-gray-600 mb-1">Dispensed</p>
                                    <p className="text-sm font-medium text-gray-900">
                                      {new Date(mostRecent.whenHandedOver).toLocaleDateString()}
                                    </p>
                                  </div>
                                )}
                                {mostRecent.quantity && (
                                  <div>
                                    <p className="text-xs text-gray-600 mb-1">Quantity</p>
                                    <p className="text-sm font-medium text-gray-900">
                                      {mostRecent.quantity.value} {mostRecent.quantity.unit?.replace(/[{}]/g, '')}
                                    </p>
                                  </div>
                                )}
                                {mostRecent.daysSupply && (
                                  <div>
                                    <p className="text-xs text-gray-600 mb-1">Supply</p>
                                    <p className="text-sm font-medium text-gray-900">
                                      {mostRecent.daysSupply.value} {mostRecent.daysSupply.unit}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Dispense History Timeline */}
                            {totalDispenses > 1 && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <details className="group/details">
                                  <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-green-600 flex items-center gap-2">
                                    <svg className="w-4 h-4 transition-transform group-open/details:rotate-90" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                    </svg>
                                    View Dispense History ({totalDispenses - 1} earlier)
                                  </summary>
                                  <div className="mt-3 ml-6 space-y-2">
                                    {med.dispenses.slice(1).map((dispense, idx) => (
                                      <div key={dispense.id || idx} className="flex items-center gap-3 text-sm py-2 border-l-2 border-gray-200 pl-4">
                                        <span className="text-gray-600 min-w-[100px]">
                                          {dispense.whenHandedOver ? new Date(dispense.whenHandedOver).toLocaleDateString() : 'Unknown date'}
                                        </span>
                                        <span className="text-gray-500">•</span>
                                        <span className="text-gray-700">
                                          {dispense.quantity?.value} {dispense.quantity?.unit?.replace(/[{}]/g, '')}
                                        </span>
                                        {dispense.daysSupply && (
                                          <>
                                            <span className="text-gray-500">•</span>
                                            <span className="text-gray-600">{dispense.daysSupply.value} {dispense.daysSupply.unit} supply</span>
                                          </>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </details>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
              {(() => {
                // Calculate unique medications count for pagination button
                const groupedMeds = medicationDispenses.reduce((acc, dispense) => {
                  const medName = dispense.medicationCodeableConcept?.text ||
                                 dispense.medicationCodeableConcept?.coding?.[0]?.display ||
                                 'Unknown Medication';
                  const medCode = dispense.medicationCodeableConcept?.coding?.[0]?.code || '';
                  const key = `${medName}_${medCode}`;
                  if (!acc[key]) acc[key] = true;
                  return acc;
                }, {} as Record<string, boolean>);
                const uniqueMedCount = Object.keys(groupedMeds).length;

                return uniqueMedCount > INITIAL_DISPLAY_COUNT && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => setShowAllMedications(!showAllMedications)}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
                    >
                      {showAllMedications ? (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                          Show Less
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          Show More ({uniqueMedCount - INITIAL_DISPLAY_COUNT} more medications)
                        </>
                      )}
                    </button>
                  </div>
                );
              })()}
            </>
          ) : !loading.medications ? (
            <p className="text-text-secondary">No medication history recorded</p>
          ) : null}
        </Card>
      </div>

      {/* Family History Section */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-text-primary mb-4 border-b border-gray-200 pb-2">
          Family History
        </h2>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Family Medical History</h3>
            {loading.familyHistory && (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            )}
          </div>

          {errors.familyHistory ? (
            <div className="text-red-600 text-sm mb-4">
              {errors.familyHistory}
              <button onClick={fetchFamilyHistory} className="ml-2 text-primary hover:underline">
                Retry
              </button>
            </div>
          ) : familyHistory.length > 0 ? (
            <>
              <div className="space-y-3">
                {(showAllFamilyHistory ? familyHistory : familyHistory.slice(0, INITIAL_DISPLAY_COUNT)).map((family, index) => {
                  // Determine relationship type for color coding
                  const relationCode = family.relationship?.coding?.[0]?.code || '';
                  const isGrandparent = relationCode.includes('GR');
                  const isParent = relationCode === 'FTH' || relationCode === 'MTH';
                  const isSibling = relationCode === 'BRO' || relationCode === 'SIS';

                  // Calculate ages
                  const bornDate = (family as any).bornDate ? new Date((family as any).bornDate) : null;
                  const deceasedDate = (family as any).deceasedDate ? new Date((family as any).deceasedDate) : null;
                  const currentAge = bornDate ? Math.floor((new Date().getTime() - bornDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;
                  const ageAtDeath = bornDate && deceasedDate ? Math.floor((deceasedDate.getTime() - bornDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;

                  // Choose color based on relationship
                  const bgColor = isGrandparent ? 'bg-amber-50 border-amber-200' :
                                  isParent ? 'bg-blue-50 border-blue-200' :
                                  isSibling ? 'bg-purple-50 border-purple-200' :
                                  'bg-gray-50 border-gray-200';

                  const iconColor = isGrandparent ? 'text-amber-600' :
                                   isParent ? 'text-blue-600' :
                                   isSibling ? 'text-purple-600' :
                                   'text-gray-600';

                  return (
                    <div key={family.id || index} className={`p-4 ${bgColor} border rounded-lg`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center">
                          <svg className={`w-5 h-5 ${iconColor} mr-2`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                          </svg>
                          <div>
                            <h4 className="font-semibold text-gray-900">
                              {family.relationship?.text || family.relationship?.coding?.[0]?.display || 'Unknown Relation'}
                            </h4>
                            {family.name && (
                              <p className="text-sm text-gray-600">{family.name}</p>
                            )}
                          </div>
                        </div>
                        {deceasedDate ? (
                          <Badge variant="danger" size="sm">
                            Deceased
                          </Badge>
                        ) : bornDate && (
                          <Badge variant="success" size="sm">
                            Living
                          </Badge>
                        )}
                      </div>

                      {/* Birth and Death Information */}
                      <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                        {bornDate && (
                          <div className="text-gray-600">
                            <span className="font-medium">Born:</span> {bornDate.getFullYear()}
                            {currentAge !== null && !deceasedDate && ` (Age ${currentAge})`}
                          </div>
                        )}
                        {deceasedDate && (
                          <div className="text-gray-600">
                            <span className="font-medium">Died:</span> {deceasedDate.getFullYear()}
                            {ageAtDeath !== null && ` (Age ${ageAtDeath})`}
                          </div>
                        )}
                      </div>

                      {/* Conditions */}
                      {family.condition && family.condition.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-sm font-semibold text-gray-700 mb-2">Medical Conditions:</p>
                          <div className="space-y-1">
                            {family.condition.map((condition: any, idx: number) => (
                              <div key={idx} className="flex items-start text-sm">
                                <span className="text-red-500 mr-2">•</span>
                                <span className="text-gray-700">
                                  {condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown condition'}
                                  {condition.onsetAge && (
                                    <span className="text-gray-500 ml-1">
                                      (onset at age {condition.onsetAge.value})
                                    </span>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {familyHistory.length > INITIAL_DISPLAY_COUNT && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => setShowAllFamilyHistory(!showAllFamilyHistory)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
                  >
                    {showAllFamilyHistory ? (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                        Show Less
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        Show More ({familyHistory.length - INITIAL_DISPLAY_COUNT} more relatives)
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          ) : !loading.familyHistory ? (
            <p className="text-text-secondary">No family history recorded</p>
          ) : null}
        </Card>
      </div>

      {/* Clinical Results Section - Based on FHIR Diagnostics Module */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-text-primary mb-4 border-b border-gray-200 pb-2">
          Clinical Results
        </h2>

        {/* Test Results (Observations) */}
        <Card className="mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Test Results & Observations</h3>
            {loading.observations && (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            )}
          </div>

          {errors.observations ? (
            <div className="text-red-600 text-sm mb-4">
              {errors.observations}
              <button onClick={fetchObservations} className="ml-2 text-primary hover:underline">
                Retry
              </button>
            </div>
          ) : observations.length > 0 ? (
            <>
              {(() => {
                // Group observations by test type
                const groupedObs = observations.reduce((acc, obs) => {
                  const testName = obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown Test';
                  const loincCode = obs.code?.coding?.find(c => c.system === 'http://loinc.org')?.code || '';
                  const key = `${testName}_${loincCode}`;

                  if (!acc[key]) {
                    acc[key] = {
                      testName,
                      loincCode,
                      category: obs.category?.[0]?.text || obs.category?.[0]?.coding?.[0]?.display || 'Other',
                      observations: []
                    };
                  }
                  acc[key].observations.push(obs);
                  return acc;
                }, {} as Record<string, { testName: string; loincCode: string; category: string; observations: typeof observations }>);

                // Convert to array and sort by most recent observation
                const tests = Object.values(groupedObs).map(test => {
                  test.observations.sort((a, b) => {
                    const dateA = a.effectiveDateTime ? new Date(a.effectiveDateTime).getTime() : 0;
                    const dateB = b.effectiveDateTime ? new Date(b.effectiveDateTime).getTime() : 0;
                    return dateB - dateA;
                  });
                  return test;
                }).sort((a, b) => {
                  const dateA = a.observations[0]?.effectiveDateTime ? new Date(a.observations[0].effectiveDateTime).getTime() : 0;
                  const dateB = b.observations[0]?.effectiveDateTime ? new Date(b.observations[0].effectiveDateTime).getTime() : 0;
                  return dateB - dateA;
                });

                const displayedTests = showAllObservations ? tests : tests.slice(0, INITIAL_DISPLAY_COUNT);

                return (
                  <>
                    <div className="space-y-3">
                      {displayedTests.map((test, index) => {
                        const mostRecent = test.observations[0];
                        const totalCount = test.observations.length;

                        // Get value display
                        let valueDisplay = '';
                        if (mostRecent.valueQuantity) {
                          valueDisplay = `${mostRecent.valueQuantity.value} ${mostRecent.valueQuantity.unit}`;
                        } else if (mostRecent.valueString) {
                          valueDisplay = mostRecent.valueString;
                        } else if (mostRecent.component && mostRecent.component.length > 0) {
                          // Handle component values like blood pressure
                          valueDisplay = mostRecent.component.map(comp =>
                            `${comp.valueQuantity?.value || ''}`
                          ).join('/') + ' ' + (mostRecent.component[0]?.valueQuantity?.unit || '');
                        }

                        // Determine icon and color based on test type and category
                        const categoryLower = test.category.toLowerCase();
                        const testNameLower = test.testName.toLowerCase();
                        let iconBgColor = 'bg-gray-100';
                        let iconColor = 'text-gray-600';
                        let icon = null;

                        // For vital signs, differentiate by test type (order matters - check most specific first)
                        if (categoryLower.includes('vital') || categoryLower.includes('signs')) {
                          if (testNameLower.includes('blood pressure') || testNameLower.includes('bp') || test.loincCode === '55284-4') {
                            // Blood Pressure - Heart icon (red)
                            iconBgColor = 'bg-red-100';
                            iconColor = 'text-red-600';
                            icon = (
                              <svg className={`w-6 h-6 ${iconColor}`} fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                              </svg>
                            );
                          } else if (testNameLower.includes('respiratory') || testNameLower.includes('breath') || testNameLower.includes('respiration') || test.loincCode === '9279-1') {
                            // Respiratory Rate - Wind icon (cyan)
                            iconBgColor = 'bg-cyan-100';
                            iconColor = 'text-cyan-600';
                            icon = (
                              <svg className={`w-6 h-6 ${iconColor}`} fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
                              </svg>
                            );
                          } else if (testNameLower.includes('heart') || testNameLower.includes('pulse') || test.loincCode === '8867-4') {
                            // Heart Rate - Activity icon (pink)
                            iconBgColor = 'bg-pink-100';
                            iconColor = 'text-pink-600';
                            icon = (
                              <svg className={`w-6 h-6 ${iconColor}`} fill="currentColor" viewBox="0 0 20 20">
                                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                              </svg>
                            );
                          } else if (testNameLower.includes('temperature') || testNameLower.includes('temp')) {
                            // Temperature - Thermometer icon (orange)
                            iconBgColor = 'bg-orange-100';
                            iconColor = 'text-orange-600';
                            icon = (
                              <svg className={`w-6 h-6 ${iconColor}`} fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 2a3 3 0 00-3 3v6a4 4 0 108 0V5a3 3 0 00-3-3zm0 11a2 2 0 100 4 2 2 0 000-4z" clipRule="evenodd" />
                              </svg>
                            );
                          } else if (testNameLower.includes('weight') || testNameLower.includes('mass')) {
                            // Weight - Scale icon (indigo)
                            iconBgColor = 'bg-indigo-100';
                            iconColor = 'text-indigo-600';
                            icon = (
                              <svg className={`w-6 h-6 ${iconColor}`} fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" clipRule="evenodd" />
                              </svg>
                            );
                          } else if (testNameLower.includes('height') || testNameLower.includes('length')) {
                            // Height - Ruler icon (teal)
                            iconBgColor = 'bg-teal-100';
                            iconColor = 'text-teal-600';
                            icon = (
                              <svg className={`w-6 h-6 ${iconColor}`} fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                              </svg>
                            );
                          } else if (testNameLower.includes('oxygen') || testNameLower.includes('spo2') || testNameLower.includes('saturation')) {
                            // Oxygen Saturation - Circle icon (sky blue)
                            iconBgColor = 'bg-sky-100';
                            iconColor = 'text-sky-600';
                            icon = (
                              <svg className={`w-6 h-6 ${iconColor}`} fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
                              </svg>
                            );
                          } else {
                            // Default vital signs - Heart icon (red)
                            iconBgColor = 'bg-red-100';
                            iconColor = 'text-red-600';
                            icon = (
                              <svg className={`w-6 h-6 ${iconColor}`} fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                              </svg>
                            );
                          }
                        } else if (categoryLower.includes('lab') || categoryLower.includes('laboratory')) {
                          // Laboratory - Beaker icon (blue)
                          iconBgColor = 'bg-blue-100';
                          iconColor = 'text-blue-600';
                          icon = (
                            <svg className={`w-6 h-6 ${iconColor}`} fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M7 2a1 1 0 00-.707 1.707L7 4.414v3.758a1 1 0 01-.293.707l-4 4C.817 14.769 2.156 18 4.828 18h10.343c2.673 0 4.012-3.231 2.122-5.121l-4-4A1 1 0 0113 8.172V4.414l.707-.707A1 1 0 0013 2H7zm2 6.172V4h2v4.172a3 3 0 00.879 2.12l1.027 1.028a4 4 0 00-2.171.102l-.47.156a4 4 0 01-2.53 0l-.563-.187a1.993 1.993 0 00-.114-.035l1.063-1.063A3 3 0 009 8.172z" clipRule="evenodd" />
                            </svg>
                          );
                        } else if (categoryLower.includes('imaging') || categoryLower.includes('radiology')) {
                          // Imaging - Camera icon (purple)
                          iconBgColor = 'bg-purple-100';
                          iconColor = 'text-purple-600';
                          icon = (
                            <svg className={`w-6 h-6 ${iconColor}`} fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                            </svg>
                          );
                        } else if (categoryLower.includes('procedure')) {
                          // Procedure - Medical icon (green)
                          iconBgColor = 'bg-green-100';
                          iconColor = 'text-green-600';
                          icon = (
                            <svg className={`w-6 h-6 ${iconColor}`} fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 3.5a1.5 1.5 0 013 0V4a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-.5a1.5 1.5 0 000 3h.5a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-.5a1.5 1.5 0 00-3 0v.5a1 1 0 01-1 1H6a1 1 0 01-1-1v-3a1 1 0 00-1-1h-.5a1.5 1.5 0 010-3H4a1 1 0 001-1V6a1 1 0 011-1h3a1 1 0 001-1v-.5z" />
                            </svg>
                          );
                        } else if (categoryLower.includes('survey') || categoryLower.includes('social')) {
                          // Survey/Social - Document icon (yellow)
                          iconBgColor = 'bg-yellow-100';
                          iconColor = 'text-yellow-600';
                          icon = (
                            <svg className={`w-6 h-6 ${iconColor}`} fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                            </svg>
                          );
                        } else {
                          // Default - Chart icon (gray)
                          iconBgColor = 'bg-gray-100';
                          iconColor = 'text-gray-600';
                          icon = (
                            <svg className={`w-6 h-6 ${iconColor}`} fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          );
                        }

                        return (
                          <div key={`${test.loincCode}_${index}`} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-start gap-4">
                              <div className={`flex-shrink-0 w-10 h-10 ${iconBgColor} rounded-lg flex items-center justify-center`}>
                                {icon}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <h4 className="text-lg font-semibold text-gray-900">{test.testName}</h4>
                                    <p className="text-sm text-gray-500">
                                      {mostRecent.effectiveDateTime ? new Date(mostRecent.effectiveDateTime).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Unknown date'}
                                    </p>
                                  </div>
                                  <Badge variant={mostRecent.status === 'final' ? 'success' : 'info'} size="sm">
                                    {mostRecent.status}
                                  </Badge>
                                </div>

                                <div className="ml-0 text-sm text-gray-600">
                                  {valueDisplay && <p className="font-medium text-gray-900">Result: {valueDisplay}</p>}
                                  <p className="text-gray-500 mt-1">
                                    {test.category}
                                    {test.loincCode && ` • LOINC: ${test.loincCode}`}
                                  </p>
                                  {totalCount > 1 && (
                                    <p className="text-blue-600 font-medium mt-2">Total measurements: {totalCount}</p>
                                  )}
                                </div>

                                {/* History */}
                                {totalCount > 1 && (
                                  <details className="mt-3 group/details">
                                    <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-purple-600 flex items-center gap-1">
                                      <svg className="w-4 h-4 transition-transform group-open/details:rotate-90" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                      </svg>
                                      View all {totalCount} measurements
                                    </summary>
                                    <div className="mt-2 space-y-2 pl-5">
                                      {test.observations.slice(1).map((obs, idx) => {
                                        let obsValue = '';
                                        if (obs.valueQuantity) {
                                          obsValue = `${obs.valueQuantity.value} ${obs.valueQuantity.unit}`;
                                        } else if (obs.valueString) {
                                          obsValue = obs.valueString;
                                        } else if (obs.component && obs.component.length > 0) {
                                          obsValue = obs.component.map(c => c.valueQuantity?.value || '').join('/') +
                                                    ' ' + (obs.component[0]?.valueQuantity?.unit || '');
                                        }

                                        return (
                                          <div key={obs.id || idx} className="py-2 border-l-2 border-gray-200 pl-3 text-sm text-gray-600">
                                            <p className="font-medium text-gray-700">
                                              {obs.effectiveDateTime ? new Date(obs.effectiveDateTime).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Unknown date'}
                                            </p>
                                            {obsValue && <p>{obsValue}</p>}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </details>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {tests.length > INITIAL_DISPLAY_COUNT && (
                      <div className="mt-4 text-center">
                        <button
                          onClick={() => setShowAllObservations(!showAllObservations)}
                          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
                        >
                          {showAllObservations ? (
                            <>
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                              Show Less
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                              Show More ({tests.length - INITIAL_DISPLAY_COUNT} more test types)
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          ) : !loading.observations ? (
            <p className="text-text-secondary">No test results or observations recorded</p>
          ) : null}
        </Card>

        {/* Diagnostic Reports - Only show if there's data */}
        {(diagnosticReports.length > 0 || loading.diagnosticReports || errors.diagnosticReports) && (
          <Card className="mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center">
                <span className="text-green-500 mr-2">📋</span>
                Diagnostic Reports
              </h3>
              {loading.diagnosticReports && (
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>

            {errors.diagnosticReports ? (
              <div className="text-red-600 text-sm mb-4">
                {errors.diagnosticReports}
                <button onClick={fetchDiagnosticReports} className="ml-2 text-primary hover:underline">
                  Retry
                </button>
              </div>
            ) : diagnosticReports.length > 0 ? (
            <>
              <div className="space-y-3">
                {(showAllDiagnosticReports ? diagnosticReports : diagnosticReports.slice(0, INITIAL_DISPLAY_COUNT)).map((report, index) => (
                  <div key={report.id || index} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-green-800">
                        {report.code?.text || report.code?.coding?.[0]?.display || 'Unknown Report'}
                      </h4>
                      <Badge
                        variant={report.status === 'final' ? 'success' : report.status === 'preliminary' ? 'warning' : 'info'}
                        size="sm"
                      >
                        {report.status}
                      </Badge>
                    </div>
                    <div className="mt-2 space-y-1">
                      {report.category && report.category.length > 0 && (
                        <p className="text-sm text-green-700">
                          Category: {report.category[0].text || report.category[0].coding?.[0]?.display}
                        </p>
                      )}
                      {report.effectiveDateTime && (
                        <p className="text-sm text-text-secondary">
                          Date: {new Date(report.effectiveDateTime).toLocaleDateString()}
                        </p>
                      )}
                      {report.effectivePeriod?.start && (
                        <p className="text-sm text-text-secondary">
                          Period: {new Date(report.effectivePeriod.start).toLocaleDateString()}
                          {report.effectivePeriod.end && ` - ${new Date(report.effectivePeriod.end).toLocaleDateString()}`}
                        </p>
                      )}
                      {report.conclusion && (
                        <p className="text-sm text-green-700 mt-2">
                          <span className="font-medium">Conclusion:</span> {report.conclusion}
                        </p>
                      )}
                      {report.performer && report.performer.length > 0 && (
                        <p className="text-sm text-text-secondary">
                          Performer: {report.performer[0].display || 'Unknown provider'}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {diagnosticReports.length > INITIAL_DISPLAY_COUNT && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => setShowAllDiagnosticReports(!showAllDiagnosticReports)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
                  >
                    {showAllDiagnosticReports ? (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                        Show Less
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        Show More ({diagnosticReports.length - INITIAL_DISPLAY_COUNT} more reports)
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          ) : !loading.diagnosticReports ? (
            <p className="text-text-secondary">No diagnostic reports recorded</p>
          ) : null}
        </Card>

        {/* Service Requests (Lab Orders) */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center">
              <span className="text-purple-500 mr-2">📝</span>
              Service Requests & Lab Orders
            </h3>
            {loading.serviceRequests && (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            )}
          </div>

          {errors.serviceRequests ? (
            <div className="text-red-600 text-sm mb-4">
              {errors.serviceRequests}
              <button onClick={fetchServiceRequests} className="ml-2 text-primary hover:underline">
                Retry
              </button>
            </div>
          ) : serviceRequests.length > 0 ? (
            <>
              <div className="space-y-3">
                {(showAllServiceRequests ? serviceRequests : serviceRequests.slice(0, INITIAL_DISPLAY_COUNT)).map((request, index) => (
                  <div key={request.id || index} className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-purple-800">
                        {request.code?.text || request.code?.coding?.[0]?.display || 'Unknown Service'}
                      </h4>
                      <Badge
                        variant={
                          request.status === 'active' ? 'warning' :
                          request.status === 'completed' ? 'success' :
                          request.status === 'revoked' ? 'danger' : 'info'
                        }
                        size="sm"
                      >
                        {request.status}
                      </Badge>
                    </div>
                    <div className="mt-2 space-y-1">
                      {request.category && request.category.length > 0 && (
                        <p className="text-sm text-purple-700">
                          Category: {request.category[0].text || request.category[0].coding?.[0]?.display}
                        </p>
                      )}
                      {request.authoredOn && (
                        <p className="text-sm text-text-secondary">
                          Ordered: {new Date(request.authoredOn).toLocaleDateString()}
                        </p>
                      )}
                      {request.requester?.display && (
                        <p className="text-sm text-text-secondary">
                          Requester: {request.requester.display}
                        </p>
                      )}
                      {request.reasonCode && request.reasonCode.length > 0 && (
                        <p className="text-sm text-purple-700">
                          Reason: {request.reasonCode[0].text || request.reasonCode[0].coding?.[0]?.display}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {serviceRequests.length > INITIAL_DISPLAY_COUNT && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => setShowAllServiceRequests(!showAllServiceRequests)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
                  >
                    {showAllServiceRequests ? (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                        Show Less
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        Show More ({serviceRequests.length - INITIAL_DISPLAY_COUNT} more requests)
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          ) : !loading.serviceRequests ? (
            <p className="text-text-secondary">No service requests or lab orders recorded</p>
          ) : null}
        </Card>
      </div>
    </div>
    );
  };

  const renderSettings = () => (
    <div className="space-y-6">
      <Card>
        <h3 className="text-lg font-semibold mb-4">Privacy Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Appointment Reminders</p>
              <p className="text-sm text-text-secondary">Receive notifications about upcoming appointments</p>
            </div>
            <button
              onClick={() => setAllowReminders(!allowReminders)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                allowReminders ? 'bg-primary' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  allowReminders ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Share Medical Data with Doctors</p>
              <p className="text-sm text-text-secondary">Allow healthcare providers to access your medical history</p>
            </div>
            <button
              onClick={() => setShareWithDoctors(!shareWithDoctors)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                shareWithDoctors ? 'bg-primary' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  shareWithDoctors ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold mb-4">Account Actions</h3>
        <div className="space-y-3">
          <Button variant="outline" className="w-full justify-start">
            Change Password
          </Button>
          <Button variant="outline" className="w-full justify-start">
            Download My Data
          </Button>
          <Button variant="danger" className="w-full justify-start">
            Delete Account
          </Button>
        </div>
      </Card>
    </div>
  );

  return (
    <Layout patientName={displayName}>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">Patient Profile</h1>
          <p className="text-text-secondary">Manage your personal information and privacy settings</p>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
          {[
            { id: 'personal' as const, label: 'Personal Info' },
            { id: 'medical' as const, label: 'Medical Info' },
            { id: 'insurance' as const, label: 'Insurance' },
            { id: 'settings' as const, label: 'Settings' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Patient Info Banner - Fixed across all tabs */}
        {patient && (
          <PatientInfoBanner
            name={extractPatientName(patient)}
            patientId={patient.id || 'Unknown'}
            gender={patient.gender}
            birthDate={patient.birthDate}
            active={patient.active}
          />
        )}

        {/* Tab Content */}
        {activeTab === 'personal' && renderPersonalInfo()}
        {activeTab === 'medical' && renderMedicalInfo()}
        {activeTab === 'insurance' && (
          <InsuranceOverview
            coverage={coverage}
            explanationOfBenefit={explanationOfBenefit}
            accounts={accounts}
            organizations={accountOrganizations}
            loading={loading.coverage || loading.encounters || loading.explanationOfBenefit}
          />
        )}
        {activeTab === 'settings' && renderSettings()}
      </div>
    </Layout>
  );
}