'use client';

import React, { useMemo, useState } from 'react';
import { Layout } from '@/components/common/Layout';
import type {
  Patient,
  Condition,
  MedicationRequest,
  MedicationDispense,
  Observation,
  AllergyIntolerance,
  DiagnosticReport,
  Coverage,
  Procedure,
  FamilyMemberHistory,
  ServiceRequest,
  ExplanationOfBenefit,
} from '@/types/fhir';
import { Badge } from '@/components/common/Badge';

interface ModernPatientProfileProps {
  patient: Patient | null;
  conditions: Condition[];
  medications: MedicationRequest[];
  medicationDispenses: MedicationDispense[];
  observations: Observation[];
  allergies: AllergyIntolerance[];
  procedures: Procedure[];
  familyHistory: FamilyMemberHistory[];
  encounters: any[];
  diagnosticReports: DiagnosticReport[];
  serviceRequests: ServiceRequest[];
  coverage: Coverage[];
  explanationOfBenefit: ExplanationOfBenefit[];
  accounts: any[];
  accountOrganizations: Record<string, any>;
  phone?: string;
  email?: string;
  address?: string;
  bloodType?: string;
  loading: Record<string, boolean>;
  encounterPractitioners: Record<string, any>;
  encounterConditions: Record<string, any>;
  encounterAccounts: Record<string, any>;
  [key: string]: any;
}

export function ModernPatientProfile({
  patient,
  conditions,
  medications,
  medicationDispenses,
  observations,
  allergies,
  procedures,
  familyHistory,
  encounters,
  diagnosticReports,
  serviceRequests,
  coverage,
  explanationOfBenefit,
  accounts,
  accountOrganizations,
  phone,
  email,
  address,
  bloodType,
  loading,
  encounterPractitioners,
  encounterConditions,
  encounterAccounts,
}: ModernPatientProfileProps) {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const toggleCard = (cardId: string) => {
    setExpandedCard(prev => prev === cardId ? null : cardId);
  };

  // Calculate patient age
  const calculateAge = (birthDate?: string) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const age = patient?.birthDate ? calculateAge(patient.birthDate) : null;
  const patientName = patient?.name?.[0]?.text ||
    `${patient?.name?.[0]?.given?.join(' ')} ${patient?.name?.[0]?.family}`.trim() ||
    'Unknown Patient';
  const gender = patient?.gender;

  // Get vital signs
  const latestVitals = useMemo(() => {
    const vitalTypes = [
      { code: '8310-5', name: 'Temperature', unit: '°C' },
      { code: '8867-4', name: 'Heart Rate', unit: 'bpm' },
      { code: '8480-6', name: 'Systolic BP', unit: 'mmHg' },
      { code: '8462-4', name: 'Diastolic BP', unit: 'mmHg' },
      { code: '59408-5', name: 'O2 Saturation', unit: '%' },
    ];

    return vitalTypes.map(vital => {
      const obs = observations.find(o =>
        o.code?.coding?.some(c => c.code === vital.code)
      );
      return {
        name: vital.name,
        value: obs?.valueQuantity?.value,
        unit: obs?.valueQuantity?.unit || vital.unit,
        date: obs?.effectiveDateTime,
      };
    }).filter(v => v.value !== undefined);
  }, [observations]);

  // Active conditions
  const activeConditions = useMemo(() =>
    conditions.filter(c => c.clinicalStatus?.coding?.[0]?.code === 'active'),
    [conditions]
  );

  // Active medications
  const activeMedications = useMemo(() =>
    medications.filter(m => m.status === 'active'),
    [medications]
  );

  // Recent encounters
  const recentEncounters = useMemo(() =>
    encounters
      .sort((a, b) => new Date(b.period?.start || 0).getTime() - new Date(a.period?.start || 0).getTime())
      .slice(0, 3),
    [encounters]
  );

  // Section Card Component - Accordion Style
  const SectionCard = ({
    id,
    title,
    count,
    icon,
    children,
    isLoading
  }: {
    id: string
    title: string
    count?: number
    icon: React.ReactNode
    children: React.ReactNode
    isLoading?: boolean
  }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <button
        onClick={() => toggleCard(id)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center bg-blue-50 rounded-lg text-primary flex-shrink-0">
            {icon}
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{title}</h3>
            {count !== undefined && (
              <p className="text-xs text-gray-500">{count} {count === 1 ? 'record' : 'records'}</p>
            )}
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${expandedCard === id ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expandedCard === id && (
        <div className="px-4 pb-4 border-t border-gray-100">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="mt-3">
              {children}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Patient Header - Compact Two Column Layout */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 sm:p-6 mb-4 shadow-lg">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl sm:text-3xl font-bold text-white flex-shrink-0">
              {patientName[0]?.toUpperCase() || 'P'}
            </div>

            {/* Two Column Content */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-3">
              {/* Left Column */}
              <div className="space-y-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">{patientName}</h1>
                {age && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-white/80" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-white/90">{age} years old</span>
                  </div>
                )}
                {gender && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-white/80" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zM4 10a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 014 10z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-white/90 capitalize">{gender}</span>
                  </div>
                )}
                {bloodType && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-white/80" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9.504 1.132a1 1 0 01.992 0l1.75 1a1 1 0 11-.992 1.736L10 3.152l-1.254.716a1 1 0 11-.992-1.736l1.75-1z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-white/90">Blood Type: {bloodType}</span>
                  </div>
                )}
              </div>

              {/* Right Column */}
              <div className="space-y-2">
                {phone && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-white/80 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                    </svg>
                    <span className="text-sm text-white/90">{phone}</span>
                  </div>
                )}
                {email ? (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-white/80 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                    </svg>
                    <span className="text-sm text-white/90 truncate">{email}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-white/80 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                    </svg>
                    <span className="text-sm text-white/60">Email not available</span>
                  </div>
                )}
                {address && (
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-white/80 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-white/90">{address}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Allergies Alert - Always Visible if present */}
        {allergies.length > 0 && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 text-sm mb-2">⚠️ Allergies ({allergies.length})</h3>
                <div className="space-y-1">
                  {allergies.slice(0, 3).map((allergy, index) => (
                    <p key={allergy.id || index} className="text-sm text-red-800 font-medium">
                      • {allergy.code?.text || allergy.code?.coding?.[0]?.display || 'Unknown Allergy'}
                    </p>
                  ))}
                  {allergies.length > 3 && (
                    <p className="text-xs text-red-700 italic">+{allergies.length - 3} more</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Vital Signs Card */}
        {latestVitals.length > 0 && (
          <div className="mb-4">
            <SectionCard
              id="vitals"
              title="Vital Signs"
              count={latestVitals.length}
              icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
              isLoading={loading.observations}
            >
              <div className="grid grid-cols-2 gap-3">
                {latestVitals.map((vital, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">{vital.name}</p>
                    <p className="text-lg font-bold text-gray-900">{vital.value} <span className="text-sm font-normal text-gray-600">{vital.unit}</span></p>
                    {vital.date && (
                      <p className="text-xs text-gray-400 mt-1">{new Date(vital.date).toLocaleDateString()}</p>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* Health Conditions Card */}
        <div className="mb-4">
          <SectionCard
            id="conditions"
            title="Health Conditions"
            count={activeConditions.length}
            icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
            isLoading={loading.conditions}
          >
            {activeConditions.length > 0 ? (
              <div className="space-y-2">
                {activeConditions.map((condition, index) => (
                  <div key={condition.id || index} className="p-3 bg-red-50 rounded-lg border border-red-100">
                    <h4 className="font-medium text-sm text-gray-900">
                      {condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown Condition'}
                    </h4>
                    {condition.recordedDate && (
                      <p className="text-xs text-gray-500 mt-1">
                        Since {new Date(condition.recordedDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No active conditions</p>
            )}
          </SectionCard>
        </div>

        {/* Medications Card */}
        <div className="mb-4">
          <SectionCard
            id="medications"
            title="Active Medications"
            count={activeMedications.length}
            icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3z" clipRule="evenodd" /></svg>}
            isLoading={loading.medications}
          >
            {activeMedications.length > 0 ? (
              <div className="space-y-2">
                {activeMedications.map((med, index) => (
                  <div key={med.id || index} className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <h4 className="font-medium text-sm text-gray-900">
                      {med.medicationCodeableConcept?.text ||
                       med.medicationCodeableConcept?.coding?.[0]?.display ||
                       'Unknown Medication'}
                    </h4>
                    {med.dosageInstruction?.[0]?.text && (
                      <p className="text-xs text-gray-600 mt-1">
                        {med.dosageInstruction[0].text}
                      </p>
                    )}
                    {med.authoredOn && (
                      <p className="text-xs text-gray-500 mt-1">
                        Prescribed {new Date(med.authoredOn).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No active medications</p>
            )}
          </SectionCard>
        </div>

        {/* Recent Visits Card */}
        <div className="mb-4">
          <SectionCard
            id="encounters"
            title="Recent Visits"
            count={recentEncounters.length}
            icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>}
            isLoading={loading.encounters}
          >
            {recentEncounters.length > 0 ? (
              <div className="space-y-2">
                {recentEncounters.map((encounter, index) => {
                  const practitionerId = encounter.participant?.[0]?.individual?.reference?.split('/')?.pop();
                  const practitioner = practitionerId ? encounterPractitioners[practitionerId] : null;
                  const practitionerName = practitioner?.name?.[0]?.text ||
                    `${practitioner?.name?.[0]?.given?.join(' ')} ${practitioner?.name?.[0]?.family}`.trim() ||
                    'Unknown Provider';

                  return (
                    <div key={encounter.id || index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="font-medium text-sm text-gray-900">
                          {encounter.type?.[0]?.text || encounter.type?.[0]?.coding?.[0]?.display || 'Office Visit'}
                        </h4>
                        <Badge
                          variant={
                            encounter.status === 'finished' ? 'success' :
                            encounter.status === 'in-progress' ? 'warning' : 'info'
                          }
                          size="sm"
                        >
                          {encounter.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600">with {practitionerName}</p>
                      {encounter.period?.start && (
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(encounter.period.start).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No encounter records</p>
            )}
          </SectionCard>
        </div>

        {/* Lab Results Card */}
        <div className="mb-4">
          <SectionCard
            id="labs"
            title="Lab Results"
            count={diagnosticReports.length}
            icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7 2a1 1 0 00-.707 1.707L7 4.414v3.758a1 1 0 01-.293.707l-4 4C.817 14.769 2.156 18 4.828 18h10.343c2.673 0 4.012-3.231 2.122-5.121l-4-4A1 1 0 0113 8.172V4.414l.707-.707A1 1 0 0013 2H7z" clipRule="evenodd" /></svg>}
            isLoading={loading.diagnosticReports}
          >
            {diagnosticReports.length > 0 ? (
              <div className="space-y-2">
                {diagnosticReports.slice(0, 5).map((report, index) => (
                  <div key={report.id || index} className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="font-medium text-sm text-gray-900">
                        {report.code?.text || report.code?.coding?.[0]?.display || 'Lab Report'}
                      </h4>
                      <Badge
                        variant={report.status === 'final' ? 'success' : report.status === 'preliminary' ? 'warning' : 'info'}
                        size="sm"
                      >
                        {report.status}
                      </Badge>
                    </div>
                    {(report.issued || report.effectiveDateTime) && (
                      <p className="text-xs text-gray-500">
                        {new Date(report.issued || report.effectiveDateTime!).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No lab results available</p>
            )}
          </SectionCard>
        </div>

        {/* Procedures Card */}
        {procedures.length > 0 && (
          <div className="mb-4">
            <SectionCard
              id="procedures"
              title="Procedures"
              count={procedures.length}
              icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z" clipRule="evenodd" /></svg>}
              isLoading={loading.procedures}
            >
              <div className="space-y-2">
                {procedures.map((procedure, index) => (
                  <div key={procedure.id || index} className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="font-medium text-sm text-gray-900">
                        {procedure.code?.text || procedure.code?.coding?.[0]?.display || 'Medical Procedure'}
                      </h4>
                      <Badge
                        variant={procedure.status === 'completed' ? 'success' : procedure.status === 'in-progress' ? 'warning' : 'info'}
                        size="sm"
                      >
                        {procedure.status}
                      </Badge>
                    </div>
                    {procedure.performedDateTime && (
                      <p className="text-xs text-gray-500">
                        {new Date(procedure.performedDateTime).toLocaleDateString()}
                      </p>
                    )}
                    {procedure.performedPeriod?.start && (
                      <p className="text-xs text-gray-500">
                        {new Date(procedure.performedPeriod.start).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* Service Requests Card */}
        {serviceRequests.length > 0 && (
          <div className="mb-4">
            <SectionCard
              id="service-requests"
              title="Service Requests"
              count={serviceRequests.length}
              icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>}
              isLoading={loading.serviceRequests}
            >
              <div className="space-y-2">
                {serviceRequests.map((request, index) => (
                  <div key={request.id || index} className="p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="font-medium text-sm text-gray-900">
                        {request.code?.text || request.code?.coding?.[0]?.display || 'Service Request'}
                      </h4>
                      <Badge
                        variant={
                          request.status === 'completed' ? 'success' :
                          request.status === 'active' ? 'warning' : 'info'
                        }
                        size="sm"
                      >
                        {request.status}
                      </Badge>
                    </div>
                    {request.authoredOn && (
                      <p className="text-xs text-gray-500">
                        Requested {new Date(request.authoredOn).toLocaleDateString()}
                      </p>
                    )}
                    {request.intent && (
                      <p className="text-xs text-gray-600 mt-1">Intent: {request.intent}</p>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* Medication Dispenses Card */}
        {medicationDispenses.length > 0 && (
          <div className="mb-4">
            <SectionCard
              id="medication-dispenses"
              title="Medication Dispenses"
              count={medicationDispenses.length}
              icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1zm-5 8.274l-.818 2.552c.25.112.526.174.818.174.292 0 .569-.062.818-.174L5 10.274zm10 0l-.818 2.552c.25.112.526.174.818.174.292 0 .569-.062.818-.174L15 10.274z" clipRule="evenodd" /></svg>}
              isLoading={loading.medications}
            >
              <div className="space-y-2">
                {medicationDispenses.map((dispense, index) => (
                  <div key={dispense.id || index} className="p-3 bg-cyan-50 rounded-lg border border-cyan-100">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="font-medium text-sm text-gray-900">
                        {dispense.medicationCodeableConcept?.text ||
                         dispense.medicationCodeableConcept?.coding?.[0]?.display ||
                         'Medication Dispense'}
                      </h4>
                      <Badge
                        variant={dispense.status === 'completed' ? 'success' : 'info'}
                        size="sm"
                      >
                        {dispense.status}
                      </Badge>
                    </div>
                    {dispense.whenHandedOver && (
                      <p className="text-xs text-gray-500">
                        Dispensed {new Date(dispense.whenHandedOver).toLocaleDateString()}
                      </p>
                    )}
                    {dispense.quantity && (
                      <p className="text-xs text-gray-600 mt-1">
                        Quantity: {dispense.quantity.value} {dispense.quantity.unit || ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* Family History Card */}
        {familyHistory.length > 0 && (
          <div className="mb-4">
            <SectionCard
              id="family-history"
              title="Family History"
              count={familyHistory.length}
              icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg>}
              isLoading={loading.familyHistory}
            >
              <div className="space-y-2">
                {familyHistory.map((history, index) => (
                  <div key={history.id || index} className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                    <h4 className="font-medium text-sm text-gray-900">
                      {history.relationship?.text || history.relationship?.coding?.[0]?.display || 'Family Member'}
                    </h4>
                    {history.condition && history.condition.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {history.condition.map((cond, condIndex) => (
                          <p key={condIndex} className="text-xs text-gray-700">
                            • {cond.code?.coding?.[0]?.display || 'Condition'}
                          </p>
                        ))}
                      </div>
                    )}
                    {history.date && (
                      <p className="text-xs text-gray-500 mt-1">Recorded {new Date(history.date).toLocaleDateString()}</p>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* Insurance Card */}
        <div className="mb-4">
          <SectionCard
            id="insurance"
            title="Insurance Coverage"
            count={coverage.length}
            icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" /></svg>}
            isLoading={loading.coverage}
          >
            {coverage.length > 0 ? (
              coverage.map((cov, index) => (
                <div key={cov.id || index} className="p-3 bg-green-50 rounded-lg border border-green-100 mb-2 last:mb-0">
                  <h4 className="font-medium text-sm text-gray-900">
                    {cov.type?.text || cov.type?.coding?.[0]?.display || 'Insurance Plan'}
                  </h4>
                  {cov.subscriberId && (
                    <p className="text-xs text-gray-600 mt-1">ID: {cov.subscriberId}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={cov.status === 'active' ? 'success' : 'info'} size="sm">
                      {cov.status}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No insurance coverage records</p>
            )}
          </SectionCard>
        </div>

        {/* Explanation of Benefit Card */}
        <div className="mb-4">
          <SectionCard
            id="eob"
            title="Explanation of Benefits (Claims)"
            count={explanationOfBenefit.length}
            icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" /><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" /></svg>}
            isLoading={loading.explanationOfBenefit}
          >
            {explanationOfBenefit.length > 0 ? (
              <div className="space-y-2">
                {explanationOfBenefit.map((eob, index) => (
                  <div key={eob.id || index} className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="font-medium text-sm text-gray-900">
                        {eob.type?.text || eob.type?.coding?.[0]?.display || 'Claim'}
                      </h4>
                      <Badge
                        variant={eob.status === 'active' ? 'success' : 'info'}
                        size="sm"
                      >
                        {eob.status}
                      </Badge>
                    </div>
                    {eob.created && (
                      <p className="text-xs text-gray-500">
                        Created {new Date(eob.created).toLocaleDateString()}
                      </p>
                    )}
                    {eob.total && eob.total.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {eob.total.map((total, totalIndex) => (
                          <p key={totalIndex} className="text-xs text-gray-700">
                            {total.category?.text || total.category?.coding?.[0]?.display}: {total.amount?.value} {total.amount?.currency || ''}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No claims records</p>
            )}
          </SectionCard>
        </div>

        {/* Accounts Card */}
        <div className="mb-6">
          <SectionCard
            id="accounts"
            title="Billing Accounts"
            count={accounts.length}
            icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>}
            isLoading={loading.encounters}
          >
            {accounts.length > 0 ? (
              <div className="space-y-2">
                {accounts.map((account, index) => {
                  const ownerId = account.owner?.reference?.split('/').pop();
                  const organization = ownerId ? accountOrganizations[ownerId] : null;

                  return (
                    <div key={account.id || index} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="font-medium text-sm text-gray-900">
                          {account.name || account.type?.[0]?.text || 'Account'}
                        </h4>
                        <Badge
                          variant={account.status === 'active' ? 'success' : 'info'}
                          size="sm"
                        >
                          {account.status}
                        </Badge>
                      </div>
                      {organization && (
                        <p className="text-xs text-gray-600 mt-1">
                          Owner: {organization.name}
                        </p>
                      )}
                      {account.type && account.type.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          Type: {account.type[0].text || account.type[0].coding?.[0]?.display}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No billing accounts</p>
            )}
          </SectionCard>
        </div>
      </div>
    </Layout>
  );
}
