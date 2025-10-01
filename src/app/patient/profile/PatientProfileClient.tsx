'use client';

import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/common/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { useAuth } from '@/components/auth/AuthProvider';
import type { Patient, Bundle, Condition, MedicationRequest, Observation, AllergyIntolerance, Procedure, FamilyMemberHistory, DiagnosticReport, ServiceRequest } from '@/types/fhir';
import type { Coverage } from '@/types/fhir';
import { HealthOverview } from '@/components/patient/HealthOverview';
import { InsuranceOverview } from '@/components/patient/InsuranceOverview';
import { EncountersOverview } from '@/components/patient/EncountersOverview';

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

  // Data states
  const [patient, setPatient] = useState<Patient | null>(null);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [medications, setMedicationRequests] = useState<MedicationRequest[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [allergies, setAllergies] = useState<AllergyIntolerance[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [familyHistory, setFamilyHistory] = useState<FamilyMemberHistory[]>([]);
  const [diagnosticReports, setDiagnosticReports] = useState<DiagnosticReport[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [coverage, setCoverage] = useState<Coverage[]>([]);
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
    coverage: false
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

  // Load data on component mount
  useEffect(() => {
    fetchPatientData();
  }, [session?.patient]);

  // Fetch patient allergies
  const fetchAllergies = async () => {
    if (!session?.patient) return;

    setLoading(prev => ({ ...prev, allergies: true }));
    setErrors(prev => ({ ...prev, allergies: '' }));

    try {
      const response = await fetch(`/api/fhir/patients/${session.patient}/allergies`, {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const bundle: Bundle<AllergyIntolerance> = await response.json();
        setAllergies(bundle.entry?.map(entry => entry.resource) || []);
      } else if (response.status === 404) {
        setAllergies([]);
      } else {
        throw new Error(`Failed to fetch allergies: ${response.status}`);
      }
    } catch (error) {
      console.error('Error fetching allergies:', error);
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
      const orgsMap: Record<string, any> = {};
      for (const account of Object.values(accountsMap)) {
        const ownerId = (account as any).owner?.reference?.split('/').pop();
        if (ownerId) {
          try {
            const orgResponse = await fetch(`/api/fhir/accounts/${(account as any).id}`, {
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
      fetchEncounters();
    }
  }, [activeTab, session?.patient]);

  // Extract patient information for display
  const displayName = patient ? extractPatientName(patient) : patientName;
  const { phone, email } = patient ? extractContactInfo(patient) : { phone: null, email: null };
  const address = patient ? extractAddress(patient) : null;

  const renderPersonalInfo = () => (
    <div className="space-y-6">
      {/* Patient Basic Info */}
      <Card>
        <div className="flex items-start space-x-4">
          {/* Avatar */}
          <div className="w-20 h-20 bg-gradient-to-br from-primary to-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
            {displayName.charAt(0).toUpperCase()}
          </div>

          {/* Patient Details */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-bold text-text-primary">{displayName}</h2>
              {(patient as any)?.active !== false && (
                <Badge variant="success" size="sm">Active</Badge>
              )}
            </div>

            {loading.patient ? (
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded animate-pulse w-32"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-48"></div>
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
              <>
                {session?.patient && (
                  <p className="text-text-secondary mb-1">Patient ID: {session.patient}</p>
                )}
                {patient?.gender && (
                  <p className="text-text-secondary mb-1">Gender: {patient.gender}</p>
                )}
                {patient?.birthDate && (
                  <p className="text-text-secondary mb-1">Birth Date: {new Date(patient.birthDate).toLocaleDateString()}</p>
                )}
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Contact Information */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">Contact Information</h3>
        {loading.patient ? (
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-40"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-56"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-72"></div>
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
        <Card className="mb-4">
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
                      {allergy.criticality && (
                        <Badge
                          variant={allergy.criticality === 'high' ? 'danger' : allergy.criticality === 'low' ? 'warning' : 'info'}
                          size="sm"
                        >
                          {allergy.criticality}
                        </Badge>
                      )}
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
        <Card className="mb-4">
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
            <div className="space-y-3">
              {conditions.map((condition, index) => (
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
          ) : !loading.conditions ? (
            <p className="text-text-secondary">No current conditions recorded</p>
          ) : null}
        </Card>
      </div>

      {/* Medications Section */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-text-primary mb-4 border-b border-gray-200 pb-2">
          Medications
        </h2>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Current Medications</h3>
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
          ) : medications.length > 0 ? (
            <div className="space-y-3">
              {medications.map((medication, index) => (
                <div key={medication.id || index} className="p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">
                      {medication.medicationCodeableConcept?.text ||
                       medication.medicationCodeableConcept?.coding?.[0]?.display ||
                       'Unknown Medication'}
                    </h4>
                    <Badge
                      variant={medication.status === 'active' ? 'success' : 'info'}
                      size="sm"
                    >
                      {medication.status}
                    </Badge>
                  </div>
                  {medication.dosageInstruction?.[0]?.text && (
                    <p className="text-sm text-text-secondary mt-1">
                      Dosage: {medication.dosageInstruction[0].text}
                    </p>
                  )}
                  {medication.authoredOn && (
                    <p className="text-sm text-text-secondary mt-1">
                      Prescribed: {new Date(medication.authoredOn).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : !loading.medications ? (
            <p className="text-text-secondary">No current medications recorded</p>
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
            <div className="space-y-3">
              {familyHistory.map((family, index) => (
                <div key={family.id || index} className="p-3 bg-purple-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">
                      {family.relationship?.text || family.relationship?.coding?.[0]?.display || 'Unknown Relation'}
                    </h4>
                    <Badge variant="info" size="sm">
                      {family.status}
                    </Badge>
                  </div>
                  {family.name && (
                    <p className="text-sm text-text-secondary">Name: {family.name}</p>
                  )}
                  {family.condition && family.condition.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium">Conditions:</p>
                      {family.condition.map((condition: any, idx: number) => (
                        <div key={idx} className="text-sm text-text-secondary ml-2">
                          • {condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown condition'}
                          {condition.onsetAge && ` (onset: age ${condition.onsetAge.value} ${condition.onsetAge.unit})`}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
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
            <h3 className="text-lg font-semibold flex items-center">
              <span className="text-blue-500 mr-2">🧪</span>
              Test Results & Observations
            </h3>
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
            <div className="space-y-3">
              {observations.map((observation, index) => (
                <div key={observation.id || index} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-blue-800">
                      {observation.code?.text || observation.code?.coding?.[0]?.display || 'Unknown Test'}
                    </h4>
                    <Badge
                      variant={observation.status === 'final' ? 'success' : 'info'}
                      size="sm"
                    >
                      {observation.status}
                    </Badge>
                  </div>
                  <div className="mt-2 space-y-1">
                    {observation.valueQuantity && (
                      <p className="text-sm text-blue-700">
                        Value: <span className="font-medium">{observation.valueQuantity.value} {observation.valueQuantity.unit}</span>
                      </p>
                    )}
                    {observation.valueString && (
                      <p className="text-sm text-blue-700">
                        Result: <span className="font-medium">{observation.valueString}</span>
                      </p>
                    )}
                    {observation.effectiveDateTime && (
                      <p className="text-sm text-text-secondary">
                        Date: {new Date(observation.effectiveDateTime).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : !loading.observations ? (
            <p className="text-text-secondary">No test results or observations recorded</p>
          ) : null}
        </Card>

        {/* Diagnostic Reports */}
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
            <div className="space-y-3">
              {diagnosticReports.map((report, index) => (
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
            <div className="space-y-3">
              {serviceRequests.map((request, index) => (
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

        {/* Tab Content */}
        {activeTab === 'personal' && renderPersonalInfo()}
        {activeTab === 'medical' && renderMedicalInfo()}
        {activeTab === 'insurance' && (
          <InsuranceOverview
            coverage={coverage}
            accounts={accounts}
            organizations={accountOrganizations}
            loading={loading.coverage || loading.encounters}
          />
        )}
        {activeTab === 'settings' && renderSettings()}
      </div>
    </Layout>
  );
}