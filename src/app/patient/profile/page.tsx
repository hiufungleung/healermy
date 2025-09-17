'use client';

import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/common/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { useAuth } from '@/components/auth/AuthProvider';
import { getPatient, getPatientConditions, getPatientMedications, getPatientObservations } from '@/app/api/fhir/patients/operations';
import type { Patient, Condition, MedicationRequest, Observation } from '@/types/fhir';

export default function PatientProfile() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<'personal' | 'medical' | 'insurance' | 'settings'>('personal');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [medications, setMedications] = useState<MedicationRequest[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Settings state
  const [allowReminders, setAllowReminders] = useState(true);
  const [shareWithDoctors, setShareWithDoctors] = useState(true);

  useEffect(() => {
    fetchPatientData();
  }, []);

  const fetchPatientData = async () => {
    if (!session?.accessToken || !session?.patientId) return;
    
    setLoading(true);
    try {
      const [patientData, conditionsData, medicationsData, observationsData] = await Promise.all([
        getPatient(session.accessToken, session.fhirBaseUrl, session.patientId),
        getPatientConditions(session.accessToken, session.fhirBaseUrl, session.patientId),
        getPatientMedications(session.accessToken, session.fhirBaseUrl, session.patientId),
        getPatientObservations(session.accessToken, session.fhirBaseUrl, session.patientId)
      ]);
      
      setPatient(patientData);
      setConditions(conditionsData);
      setMedications(medicationsData);
      setObservations(observationsData);
    } catch (error) {
      console.error('Error fetching patient data:', error);
      // Use mock data for demo
      setPatient(mockPatient);
      setConditions(mockConditions);
      setMedications(mockMedications);
      setObservations(mockObservations);
    } finally {
      setLoading(false);
    }
  };

  // Mock data for demo
  const mockPatient: Patient = {
    resourceType: 'Patient',
    id: 'demo-patient',
    name: [{ given: ['John'], family: 'Smith' }],
    gender: 'male',
    birthDate: '1985-03-15',
    telecom: [
      { system: 'phone', value: '+61 2 9999 1234' },
      { system: 'email', value: 'john.smith@email.com' }
    ],
    address: [{
      line: ['123 Main Street'],
      city: 'Sydney',
      state: 'NSW',
      postalCode: '2000',
      country: 'Australia'
    }],
    identifier: [{ value: 'PAT123456' }]
  };

  const mockConditions: Condition[] = [
    {
      resourceType: 'Condition',
      id: '1',
      code: { text: 'Hypertension' },
      clinicalStatus: { coding: [{ code: 'active' }] },
      recordedDate: '2023-01-15'
    },
    {
      resourceType: 'Condition',
      id: '2',
      code: { text: 'Type 2 Diabetes' },
      clinicalStatus: { coding: [{ code: 'active' }] },
      recordedDate: '2022-08-20'
    }
  ];

  const mockMedications: MedicationRequest[] = [
    {
      resourceType: 'MedicationRequest',
      id: '1',
      status: 'active',
      medicationCodeableConcept: { text: 'Metformin 500mg' },
      dosageInstruction: [{ text: 'Take twice daily with meals' }],
      authoredOn: '2023-01-15'
    }
  ];

  const mockObservations: Observation[] = [
    {
      resourceType: 'Observation',
      id: '1',
      status: 'final',
      code: { text: 'Blood Pressure' },
      valueQuantity: { value: 120, unit: 'mmHg' },
      effectiveDateTime: '2024-01-10'
    }
  ];

  const patientName = patient?.name?.[0] ? `${patient.name[0].given?.join(' ')} ${patient.name[0].family}` : 'John Smith';
  const patientEmail = patient?.telecom?.find(t => t.system === 'email')?.value || 'john.smith@email.com';
  const patientId = patient?.identifier?.[0]?.value || 'PAT123456';

  const renderPersonalInfo = () => (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">First Name</label>
          <input
            type="text"
            value={patient?.name?.[0]?.given?.join(' ') || 'John'}
            className="w-full px-3 py-2 border rounded-lg bg-gray-50"
            readOnly
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Last Name</label>
          <input
            type="text"
            value={patient?.name?.[0]?.family || 'Smith'}
            className="w-full px-3 py-2 border rounded-lg bg-gray-50"
            readOnly
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={patientEmail}
            className="w-full px-3 py-2 border rounded-lg bg-gray-50"
            readOnly
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input
            type="tel"
            value={patient?.telecom?.find(t => t.system === 'phone')?.value || '+61 2 9999 1234'}
            className="w-full px-3 py-2 border rounded-lg bg-gray-50"
            readOnly
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Date of Birth</label>
          <input
            type="date"
            value={patient?.birthDate || '1985-03-15'}
            className="w-full px-3 py-2 border rounded-lg bg-gray-50"
            readOnly
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Gender</label>
          <input
            type="text"
            value={patient?.gender || 'Male'}
            className="w-full px-3 py-2 border rounded-lg bg-gray-50 capitalize"
            readOnly
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Address</label>
        <textarea
          value={patient?.address?.[0] ? `${patient.address[0].line?.join(', ')}\n${patient.address[0].city}, ${patient.address[0].state} ${patient.address[0].postalCode}` : '123 Main Street\nSydney, NSW 2000'}
          className="w-full px-3 py-2 border rounded-lg bg-gray-50"
          rows={3}
          readOnly
        />
      </div>
    </div>
  );

  const renderMedicalInfo = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Medical Conditions</h3>
        <div className="space-y-3">
          {conditions.map((condition) => (
            <div key={condition.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">{condition.code?.text}</p>
                <p className="text-sm text-text-secondary">
                  Diagnosed: {new Date(condition.recordedDate || '').toLocaleDateString()}
                </p>
              </div>
              <Badge variant={condition.clinicalStatus?.coding?.[0]?.code === 'active' ? 'warning' : 'info'} size="sm">
                {condition.clinicalStatus?.coding?.[0]?.code || 'active'}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Current Medications</h3>
        <div className="space-y-3">
          {medications.map((medication) => (
            <div key={medication.id} className="p-3 border rounded-lg">
              <p className="font-medium">{medication.medicationCodeableConcept?.text}</p>
              <p className="text-sm text-text-secondary">
                {medication.dosageInstruction?.[0]?.text}
              </p>
              <p className="text-sm text-text-secondary">
                Prescribed: {new Date(medication.authoredOn || '').toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Recent Test Results</h3>
        <div className="space-y-3">
          {observations.map((observation) => (
            <div key={observation.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">{observation.code?.text}</p>
                <p className="text-sm text-text-secondary">
                  {new Date(observation.effectiveDateTime || '').toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  {observation.valueQuantity?.value} {observation.valueQuantity?.unit}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderInsurance = () => (
    <div className="space-y-6">
      <div className="text-center py-8">
        <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-text-secondary">Insurance information will be available when connected to your health plan</p>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Privacy Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">Allow appointment reminders</p>
              <p className="text-sm text-text-secondary">Receive email and SMS reminders</p>
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

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">Share medical data with doctors</p>
              <p className="text-sm text-text-secondary">Allow doctors to access your medical history</p>
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
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Account Actions</h3>
        <div className="space-y-3">
          <Button variant="outline" fullWidth>
            <div className="flex items-center justify-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Change Password</span>
            </div>
          </Button>
          <Button variant="outline" fullWidth>
            <div className="flex items-center justify-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Download My Data</span>
            </div>
          </Button>
          <Button variant="danger" fullWidth>
            <div className="flex items-center justify-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Delete Account</span>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">My Profile</h1>
          <p className="text-text-secondary">Manage your personal and medical information</p>
        </div>

        {/* Profile Header */}
        <Card className="mb-8">
          <div className="bg-primary text-white rounded-lg p-6 -m-6 mb-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold">{patientName}</h2>
                <p className="opacity-90">{patientEmail}</p>
                <p className="opacity-75 text-sm">Patient ID: #{patientId}</p>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-b">
            <div className="flex space-x-8">
              {[
                {
                  key: 'personal',
                  label: 'Personal Info',
                  icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )
                },
                {
                  key: 'medical',
                  label: 'Medical Info',
                  icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )
                },
                {
                  key: 'insurance',
                  label: 'Insurance',
                  icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  )
                },
                {
                  key: 'settings',
                  label: 'Settings',
                  icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )
                }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.key
                      ? 'border-primary text-primary'
                      : 'border-transparent text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Tab Content */}
        <Card>
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-2 text-text-secondary">Loading profile information...</p>
            </div>
          ) : (
            <>
              {activeTab === 'personal' && renderPersonalInfo()}
              {activeTab === 'medical' && renderMedicalInfo()}
              {activeTab === 'insurance' && renderInsurance()}
              {activeTab === 'settings' && renderSettings()}
            </>
          )}
        </Card>
      </div>
    </Layout>
  );
}