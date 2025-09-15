'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Layout } from '@/components/common/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { useAuth } from '@/components/auth/AuthProvider';
import { getPatient, getPatientConditions, getPatientMedications, getPatientObservations } from '@/app/api/fhir/patients/operations';
import type { Patient, Condition, MedicationRequest, Observation, Appointment } from '@/types/fhir';

export default function PreVisitSummary() {
  const router = useRouter();
  const params = useParams();
  const { session } = useAuth();
  const appointmentId = params.appointmentId as string;
  
  const [patient, setPatient] = useState<Patient | null>(null);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [medications, setMedications] = useState<MedicationRequest[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [activeTab, setActiveTab] = useState<'current' | 'history' | 'results'>('current');
  const [clinicianNotes, setClinicianNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPatientData();
  }, []);

  const fetchPatientData = async () => {
    if (!session?.accessToken || !session?.patient || !session?.fhirBaseUrl) return;
    
    setLoading(true);
    try {
      const [patientData, conditionsData, medicationsData, observationsData] = await Promise.all([
        getPatient(session.accessToken, session.fhirBaseUrl, session.patient),
        getPatientConditions(session.accessToken, session.fhirBaseUrl, session.patient),
        getPatientMedications(session.accessToken, session.fhirBaseUrl, session.patient),
        getPatientObservations(session.accessToken, session.fhirBaseUrl, session.patient)
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

  const handleSaveNotes = () => {
    // In a real app, this would save to FHIR
    console.log('Saving clinician notes:', clinicianNotes);
    alert('Notes saved successfully');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    // In a real app, this would generate a PDF or export data
    alert('Export functionality would be implemented here');
  };

  // Mock data for demo
  const mockPatient: Patient = {
    resourceType: 'Patient',
    id: 'demo-patient',
    name: [{ given: ['Sarah'], family: 'Mitchel' }],
    gender: 'female',
    birthDate: '1990-03-15',
    telecom: [
      { system: 'email', value: 'sarah@gmail.com' }
    ],
  };

  const mockConditions: Condition[] = [
    {
      resourceType: 'Condition',
      id: '1',
      code: { text: 'Thyroid condition' },
      clinicalStatus: { coding: [{ code: 'active' }] },
      onsetDateTime: '2023-01-15'
    },
    {
      resourceType: 'Condition',
      id: '2',
      code: { text: 'Chronic fatigue' },
      clinicalStatus: { coding: [{ code: 'active' }] },
      onsetDateTime: '2024-06-20'
    }
  ];

  const mockMedications: MedicationRequest[] = [
    {
      resourceType: 'MedicationRequest',
      id: '1',
      status: 'active',
      medicationCodeableConcept: { text: 'Levothyroxine 50mcg' },
      dosageInstruction: [{ text: 'Once daily in the morning' }],
      authoredOn: '2023-01-15'
    },
    {
      resourceType: 'MedicationRequest',
      id: '2',
      status: 'active',
      medicationCodeableConcept: { text: 'Vitamin D3 1000IU' },
      dosageInstruction: [{ text: 'Once daily with food' }],
      authoredOn: '2024-02-10'
    },
    {
      resourceType: 'MedicationRequest',
      id: '3',
      status: 'active',
      medicationCodeableConcept: { text: 'Iron supplement' },
      dosageInstruction: [{ text: 'Twice daily with meals' }],
      authoredOn: '2024-06-20'
    }
  ];

  const mockObservations: Observation[] = [
    {
      resourceType: 'Observation',
      id: '1',
      status: 'final',
      code: { text: 'TSH Level' },
      valueQuantity: { value: 2.5, unit: 'mIU/L' },
      effectiveDateTime: '2024-12-15'
    },
    {
      resourceType: 'Observation',
      id: '2',
      status: 'final',
      code: { text: 'Heart Rate' },
      valueQuantity: { value: 82, unit: 'bpm' },
      effectiveDateTime: '2024-12-15'
    }
  ];

  const patientName = patient?.name?.[0] ? `${patient.name[0].given?.join(' ')} ${patient.name[0].family}` : 'Sarah Mitchel';
  const patientId = patient?.identifier?.[0]?.value || 'P-12345';
  const patientEmail = patient?.telecom?.find(t => t.system === 'email')?.value || 'sarah@gmail.com';
  const age = patient?.birthDate ? new Date().getFullYear() - new Date(patient.birthDate).getFullYear() : 34;

  const totalVisits = 8;
  const activeOrders = 2;
  const totalMedications = medications.length || 3;

  const mockAppointment = {
    date: '2025-09-06',
    time: '10:30 AM',
    doctor: 'Dr. Johnson',
    type: 'Follow-up',
    urgent: true
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <div className="flex items-center text-sm text-text-secondary mb-2">
              <span>Patients</span>
              <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span>{patientName}</span>
            </div>
            <h1 className="text-3xl font-bold text-text-primary">Patient Information</h1>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button variant="outline" onClick={handlePrint}>
              Print
            </Button>
            <Button variant="outline" onClick={handleExport}>
              Export
            </Button>
            <Button 
              variant="outline" 
              onClick={() => router.back()}
            >
              ← Back
            </Button>
          </div>
        </div>

        {/* Patient Header Card */}
        <Card className="mb-8">
          <div className="bg-gradient-to-r from-primary to-purple-600 text-white rounded-lg p-6 -m-6 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold">
                  {patientName.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <h2 className="text-3xl font-bold mb-1">{patientName}</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="opacity-75">ID:</span> {patientId}
                    </div>
                    <div>
                      <span className="opacity-75">Dr:</span> {mockAppointment.doctor}
                    </div>
                    <div>
                      <span className="opacity-75">Email:</span> {patientEmail}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-8 mt-4 text-center">
                    <div>
                      <span className="opacity-75">Age:</span> {age}
                    </div>
                    <div>
                      <span className="opacity-75">Gender:</span> {patient?.gender || 'Female'}
                    </div>
                    <div>
                      <span className="opacity-75">Blood Type:</span> A+
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Stats */}
            <div className="bg-white/10 backdrop-blur rounded-lg p-4 mt-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-3xl font-bold">{totalVisits}</div>
                  <div className="text-sm opacity-75">Total Visits</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">{activeOrders}</div>
                  <div className="text-sm opacity-75">Active Orders</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">{totalMedications}</div>
                  <div className="text-sm opacity-75">Medications</div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Upcoming Appointment */}
        <Card className="mb-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">Upcoming Appointment</h3>
              <p className="text-text-secondary">
                {new Date(mockAppointment.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} | {mockAppointment.time}
              </p>
            </div>
            {mockAppointment.urgent && (
              <Badge variant="danger" size="sm">Urgent</Badge>
            )}
          </div>
        </Card>

        {/* Tabs */}
        <div className="border-b mb-6">
          <div className="flex space-x-8">
            {[
              { key: 'current', label: 'Current Visit' },
              { key: 'history', label: 'Medical History' },
              { key: 'results', label: 'Test Results' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'current' && (
          <Card>
            <h3 className="text-xl font-semibold mb-4">Visit Reason & Health Concerns</h3>
            
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Reason for Visit:</label>
                  <p className="text-text-secondary bg-gray-50 p-3 rounded-lg">
                    Chronic Disease Management, Follow-up
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Requested Longer Appointment:</label>
                  <p className="text-text-secondary bg-gray-50 p-3 rounded-lg">Yes</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Concerns / Symptoms:</label>
                <p className="text-text-secondary bg-gray-50 p-3 rounded-lg">
                  Feeling fatigued for over two weeks, experiencing irregular heartbeat and chest discomfort, 
                  interested in follow-up for thyroid condition.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Reason for Longer Appointment:</label>
                <p className="text-text-secondary bg-gray-50 p-3 rounded-lg">
                  Patient needs detailed discussion on thyroid, fatigue, chest pain, and past test results. 
                  Suspects multiple chronic conditions.
                </p>
              </div>
            </div>
          </Card>
        )}

        {activeTab === 'history' && (
          <Card>
            <h3 className="text-xl font-semibold mb-4">Medical History</h3>
            
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold mb-3">Current Conditions</h4>
                <div className="space-y-2">
                  {conditions.map((condition) => (
                    <div key={condition.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{condition.code?.text}</p>
                        <p className="text-sm text-text-secondary">
                          Since: {new Date(condition.recordedDate || '').toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="warning" size="sm">Active</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Current Medications</h4>
                <div className="space-y-2">
                  {medications.map((medication) => (
                    <div key={medication.id} className="p-3 border rounded-lg">
                      <p className="font-medium">{medication.medicationCodeableConcept?.text}</p>
                      <p className="text-sm text-text-secondary">
                        {medication.dosageInstruction?.[0]?.text}
                      </p>
                      <p className="text-xs text-text-secondary">
                        Started: {new Date(medication.authoredOn || '').toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}

        {activeTab === 'results' && (
          <Card>
            <h3 className="text-xl font-semibold mb-4">Recent Test Results</h3>
            
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
                    <Badge variant="success" size="sm">Normal</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Clinician Notes */}
        <Card className="mt-6">
          <h3 className="text-xl font-semibold mb-4">Clinician Notes</h3>
          <textarea
            value={clinicianNotes}
            onChange={(e) => setClinicianNotes(e.target.value)}
            placeholder="Add notes here..."
            className="w-full h-40 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
          <div className="mt-4 text-center">
            <Button variant="primary" onClick={handleSaveNotes}>
              Save Notes
            </Button>
          </div>
        </Card>
      </div>
    </Layout>
  );
}