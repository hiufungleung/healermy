'use client';

import React, { useMemo } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorCard } from '@/components/common/ErrorCard';
import { ContentSkeleton, VitalsSkeleton } from '@/components/common/ContentSkeleton';
import {
  User,
  Calendar,
  Droplet,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
  Activity,
  Pill,
  Stethoscope,
  Users,
  ClipboardList,
  TestTube,
  ScrollText,
  Shield,
  ChevronDown,
} from 'lucide-react';

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
  encounterPractitioners,
  encounterConditions,
  encounterAccounts,
  phone,
  email,
  address,
  bloodType,
  loading,
  errors,
  refetchers,
}: ModernPatientProfileProps) {
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
  
  // Safe patient name extraction with loading state check
  const patientName = React.useMemo(() => {
    if (loading.patient || !patient) {
      return null; // Return null during loading to trigger skeleton
    }
    return patient?.name?.[0]?.text ||
      `${patient?.name?.[0]?.given?.join(' ')} ${patient?.name?.[0]?.family}`.trim() ||
      'Unknown Patient';
  }, [patient, loading.patient]);
  
  const gender = patient?.gender;

  // Get vital signs
  const latestVitals = useMemo(() => {
    const vitalTypes = [
      { code: '8867-4', name: 'Heart Rate', unit: 'bpm' },
      { code: '8480-6', name: 'Systolic BP', unit: 'mmHg' },
      { code: '8462-4', name: 'Diastolic BP', unit: 'mmHg' },
      { code: '8310-5', name: 'Body Temperature', unit: '°F' },
      { code: '9279-1', name: 'Respiratory Rate', unit: '/min' },
    ];

    return vitalTypes.map(vitalType => {
      const obs = observations.find(o =>
        o.code?.coding?.some(c => c.code === vitalType.code)
      );
      return {
        name: vitalType.name,
        value: obs?.valueQuantity?.value,
        unit: obs?.valueQuantity?.unit || vitalType.unit,
        date: obs?.effectiveDateTime,
      };
    }).filter(v => v.value !== undefined);
  }, [observations]);

  // Enhanced Section Card Component with complete state handling
  const SectionCard = ({
    title,
    count,
    icon: Icon,
    children,
    isLoading,
    error,
    isEmpty,
    emptyMessage,
    onRetry,
    defaultOpen = false,
    skeletonVariant = 'list',
  }: {
    title: string;
    count?: number;
    icon: React.ElementType;
    children: React.ReactNode;
    isLoading?: boolean;
    error?: string;
    isEmpty?: boolean;
    emptyMessage?: string;
    onRetry?: () => void;
    defaultOpen?: boolean;
    skeletonVariant?: 'default' | 'list' | 'card' | 'timeline';
  }) => {
    // Determine what to render based on state
    const renderContent = () => {
      // State 1: Loading
      if (isLoading) {
        return <ContentSkeleton variant={skeletonVariant} items={3} />;
      }

      // State 2: Error
      if (error) {
        return (
          <ErrorCard
            variant="compact"
            message={error}
            onRetry={onRetry}
            retryLabel="Reload"
          />
        );
      }

      // State 3: Empty data
      if (isEmpty) {
        return (
          <EmptyState
            variant="compact"
            icon={Icon as any}
            message={emptyMessage || `No ${title} data`}
          />
        );
      }

      // State 4: Has data
      return children;
    };

    return (
      <Collapsible defaultOpen={defaultOpen}>
        <Card className="shadow-md border-gray-200 mb-6">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="hover:bg-gray-50 transition-colors cursor-pointer p-5">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 flex items-center justify-center bg-blue-100 rounded-xl text-primary shadow-sm">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <CardTitle className="text-base sm:text-lg font-semibold">{title}</CardTitle>
                    {count !== undefined && !isLoading && (
                      <p className="text-sm text-gray-500 mt-1">
                        {count} {count === 1 ? 'record' : 'records'}
                      </p>
                    )}
                    {isLoading && (
                      <p className="text-sm text-gray-400 mt-1">Loading...</p>
                    )}
                  </div>
                </div>
                <ChevronDown className="w-6 h-6 text-gray-400 transition-transform" />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-4 px-5 pb-5">
              {renderContent()}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Patient Header - Clean Card Layout */}
        {loading.patient || !patientName ? (
          // Show skeleton during patient data loading
          <Card className="mb-6 shadow-md border-gray-200">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
                <div className="space-y-3">
                  <Skeleton className="h-8 w-56" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-56" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-6 shadow-md border-gray-200">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
                {/* Left Column */}
                <div className="space-y-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">{patientName}</h1>
                  {age && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-600" />
                      <span className="text-sm text-gray-700">{age} years old</span>
                    </div>
                  )}
                  {gender && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-600" />
                      <span className="text-sm text-gray-700 capitalize">{gender}</span>
                    </div>
                  )}
                  {bloodType && (
                    <div className="flex items-center gap-2">
                      <Droplet className="w-4 h-4 text-gray-600" />
                      <span className="text-sm text-gray-700">Blood Type: {bloodType}</span>
                    </div>
                  )}
                </div>

                {/* Right Column */}
                <div className="space-y-3">
                  {phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-600" />
                      <span className="text-sm text-gray-700">{phone}</span>
                    </div>
                  )}
                  {email ? (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-600" />
                      <span className="text-sm text-gray-700 truncate">{email}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-400">Email not available</span>
                    </div>
                  )}
                  {address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-gray-600 mt-0.5" />
                      <span className="text-sm text-gray-700">{address}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Allergies Alert - Always Visible if present */}
        {!loading.patient && allergies.length > 0 && (
          <Card className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-300 mb-6 shadow-md">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                  <AlertTriangle className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-lg font-bold text-red-900">Critical: Allergies</h3>
                    <Badge variant="danger" className="text-xs">
                      {allergies.length} {allergies.length === 1 ? 'Allergy' : 'Allergies'}
                    </Badge>
                  </div>
                  <div className="grid gap-2">
                    {allergies.map((allergy, index) => (
                      <div key={allergy.id || index} className="bg-white rounded-lg p-3 border border-red-200 shadow-sm">
                        <p className="text-sm font-semibold text-red-900">
                          {allergy.code?.text || allergy.code?.coding?.[0]?.display || 'Unknown Allergy'}
                        </p>
                        {allergy.criticality && (
                          <p className="text-xs text-red-700 mt-1">
                            Severity: <span className="font-medium capitalize">{allergy.criticality}</span>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Vital Signs */}
        {latestVitals.length > 0 && (
          <Card className="mb-6 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Latest Vitals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {latestVitals.map((vital, index) => (
                  <div key={index} className="bg-blue-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600 mb-1">{vital.name}</p>
                    <p className="text-sm sm:text-base md:text-lg font-semibold text-primary">
                      {vital.value} <span className="text-sm font-normal">{vital.unit}</span>
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Medical Information Sections */}
        <div className="space-y-3">
          {/* Conditions */}
          <SectionCard
            title="Conditions"
            count={conditions.length}
            icon={Stethoscope}
            isLoading={loading.conditions}
            error={errors?.conditions}
            isEmpty={!loading.conditions && conditions.length === 0}
            emptyMessage="No conditions recorded"
            onRetry={refetchers?.conditions}
            defaultOpen={true}
            skeletonVariant="list"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {conditions.map((condition, index) => (
                <div key={condition.id || index} className="bg-blue-50 border-l-4 border-blue-400 rounded-r-lg p-3 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-semibold text-gray-900 text-sm leading-tight">
                      {condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown Condition'}
                    </p>
                    {condition.clinicalStatus?.coding?.[0]?.code && (
                      <Badge variant={condition.clinicalStatus.coding[0].code === 'active' ? 'warning' : 'info'} className="text-xs px-2 py-0.5 flex-shrink-0">
                        {condition.clinicalStatus.coding[0].code}
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1 text-xs text-gray-600">
                    {condition.onsetDateTime && (
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Onset: {new Date(condition.onsetDateTime).toLocaleDateString()}</span>
                      </div>
                    )}
                    {condition.id && (
                      <div className="text-xs text-gray-400 mt-1 truncate" title={condition.id}>
                        ID: {condition.id}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Medications */}
          <SectionCard
            title="Medications"
            count={medications.length}
            icon={Pill}
            isLoading={loading.medications}
            error={errors?.medications}
            isEmpty={!loading.medications && medications.length === 0}
            emptyMessage="No medications recorded"
            onRetry={refetchers?.medications}
            skeletonVariant="list"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {medications.map((med, index) => {
                // Try to find related condition
                const relatedCondition = med.reasonReference?.find(ref =>
                  ref.reference?.startsWith('Condition/')
                );
                const conditionId = relatedCondition?.reference?.replace('Condition/', '');
                const linkedCondition = conditionId ? conditions.find(c => c.id === conditionId) : null;

                // Try to find related encounter
                const encounterId = med.encounter?.reference?.replace('Encounter/', '');
                const linkedEncounter = encounterId ? encounters.find(e => e.id === encounterId) : null;

                // Find related dispense records
                const relatedDispenses = medicationDispenses.filter(dispense =>
                  dispense.authorizingPrescription?.some(ref =>
                    ref.reference === `MedicationRequest/${med.id}`
                  )
                );

                return (
                  <div key={med.id || index} className="bg-green-50 border-l-4 border-green-400 rounded-r-lg p-3 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-semibold text-gray-900 text-sm leading-tight">
                        {med.medicationCodeableConcept?.text ||
                         med.medicationCodeableConcept?.coding?.[0]?.display ||
                         'Unknown Medication'}
                      </p>
                      {med.status && (
                        <Badge variant={med.status === 'active' ? 'success' : 'info'} className="text-xs px-2 py-0.5 flex-shrink-0">
                          {med.status}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1 text-xs text-gray-600">
                      {med.dosageInstruction?.[0]?.text && (
                        <div className="flex items-center gap-1.5">
                          <Pill className="w-3.5 h-3.5" />
                          <span className="font-medium">{med.dosageInstruction[0].text}</span>
                        </div>
                      )}
                      {med.authoredOn && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Prescribed: {new Date(med.authoredOn).toLocaleDateString()}</span>
                        </div>
                      )}
                      {linkedEncounter && (
                        <div className="flex items-center gap-1.5 text-blue-600">
                          <Activity className="w-3.5 h-3.5" />
                          <span>
                            Visit: {linkedEncounter.period?.start
                              ? new Date(linkedEncounter.period.start).toLocaleDateString()
                              : 'Unknown date'}
                          </span>
                        </div>
                      )}
                      {med.dispenseRequest?.validityPeriod?.start && med.dispenseRequest?.validityPeriod?.end && (
                        <div className="flex items-center gap-1.5 text-indigo-600">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            Valid: {new Date(med.dispenseRequest.validityPeriod.start).toLocaleDateString()} - {new Date(med.dispenseRequest.validityPeriod.end).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {relatedDispenses.length > 0 && (
                        <div className="flex items-center gap-1.5 text-purple-600">
                          <Pill className="w-3.5 h-3.5" />
                          <span>
                            Last dispensed: {new Date(relatedDispenses[0].whenHandedOver || relatedDispenses[0].whenPrepared || '').toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {linkedCondition && (
                        <div className="flex items-center gap-1.5 text-amber-600">
                          <Stethoscope className="w-3.5 h-3.5" />
                          <span className="truncate" title={linkedCondition.code?.text || linkedCondition.code?.coding?.[0]?.display}>
                            For: {linkedCondition.code?.text || linkedCondition.code?.coding?.[0]?.display}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Procedures */}
          <SectionCard
            title="Procedures"
            count={procedures.length}
            icon={ClipboardList}
            isLoading={loading.procedures}
            error={errors?.procedures}
            isEmpty={!loading.procedures && procedures.length === 0}
            emptyMessage="No procedures recorded yet. Procedures are medical interventions performed to diagnose or treat conditions."
            onRetry={refetchers?.procedures}
            skeletonVariant="list"
          >
              <div className="space-y-4">
                {procedures.map((proc, index) => {
                  // Try to find related condition by checking if procedure mentions condition in reasonReference
                  const relatedCondition = proc.reasonReference?.find(ref => 
                    ref.reference?.startsWith('Condition/')
                  );
                  const conditionId = relatedCondition?.reference?.replace('Condition/', '');
                  const linkedCondition = conditionId ? conditions.find(c => c.id === conditionId) : null;
                  
                  return (
                    <div key={proc.id || index} className="bg-purple-50 border-l-4 border-purple-400 rounded-r-xl p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between">
                        <p className="font-semibold text-gray-900 text-base">
                          {proc.code?.text || proc.code?.coding?.[0]?.display || 'Unknown Procedure'}
                        </p>
                        {proc.status && (
                          <Badge variant={
                            proc.status === 'completed' ? 'success' : 
                            proc.status === 'in-progress' ? 'warning' : 
                            'info'
                          }>
                            {proc.status}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-2 space-y-1 text-sm text-gray-600">
                        {(proc.performedDateTime || proc.performedPeriod?.start) && (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>
                              Performed: {proc.performedDateTime 
                                ? new Date(proc.performedDateTime).toLocaleDateString()
                                : proc.performedPeriod?.start 
                                  ? new Date(proc.performedPeriod.start).toLocaleDateString()
                                  : 'Unknown date'}
                            </span>
                          </div>
                        )}
                        {linkedCondition && (
                          <div className="flex items-center gap-2 text-blue-600">
                            <Stethoscope className="w-4 h-4" />
                            <span>
                              Related to: <span className="font-medium">
                                {linkedCondition.code?.text || linkedCondition.code?.coding?.[0]?.display}
                              </span>
                            </span>
                          </div>
                        )}
                        {proc.performer && proc.performer.length > 0 && proc.performer[0].actor?.display && (
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span>Performed by: {proc.performer[0].actor.display}</span>
                          </div>
                        )}
                        {proc.outcome?.text && (
                          <div className="mt-2 text-xs bg-white rounded px-2 py-1">
                            <span className="font-medium">Outcome:</span> {proc.outcome.text}
                          </div>
                        )}
                        {proc.note && proc.note.length > 0 && (
                          <div className="mt-2 text-xs bg-white rounded px-2 py-1">
                            <span className="font-medium">Notes:</span> {proc.note[0].text}
                          </div>
                        )}
                        {proc.id && (
                          <div className="text-xs text-gray-400 mt-2">
                            ID: {proc.id}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
          </SectionCard>

          {/* Family History */}
          <SectionCard
            title="Family History"
            count={familyHistory.length}
            icon={Users}
            isLoading={loading.familyHistory}
            error={errors?.familyHistory}
            isEmpty={!loading.familyHistory && familyHistory.length === 0}
            emptyMessage="No family history recorded"
            onRetry={refetchers?.familyHistory}
            skeletonVariant="card"
          >
              <div className="space-y-3">
                {familyHistory.map((family, index) => (
                  <div key={family.id || index} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-medium text-gray-900">
                        {family.relationship?.text || family.relationship?.coding?.[0]?.display || 'Family Member'}
                      </p>
                      {family.name && (
                        <span className="text-sm text-gray-600">({family.name})</span>
                      )}
                    </div>
                    {family.condition && family.condition.length > 0 && (
                      <ul className="mt-2 space-y-1 text-sm text-gray-700">
                        {family.condition.map((condition, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                            <span>
                              {condition.code?.coding?.[0]?.display ||
                                condition.code?.text ||
                                'Condition'}
                              {condition.onsetAge?.value && (
                                <span className="ml-2 text-xs text-gray-500">
                                  (onset at age {condition.onsetAge.value})
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
          </SectionCard>

          {/* Diagnostic Reports */}
          <SectionCard
            title="Diagnostic Reports"
            count={diagnosticReports.length}
            icon={TestTube}
            isLoading={loading.diagnosticReports}
            error={errors?.diagnosticReports}
            isEmpty={!loading.diagnosticReports && diagnosticReports.length === 0}
            emptyMessage="No diagnostic reports"
            onRetry={refetchers?.diagnosticReports}
            skeletonVariant="list"
          >
              <div className="space-y-2">
                {diagnosticReports.map((report, index) => (
                  <div key={report.id || index} className="border-l-2 border-yellow-200 pl-3 py-1">
                    <p className="font-medium text-gray-900">
                      {report.code?.text || report.code?.coding?.[0]?.display || 'Diagnostic Report'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {report.status && (
                        <Badge variant={report.status === 'final' ? 'success' : 'warning'}>
                          {report.status}
                        </Badge>
                      )}
                      {report.effectiveDateTime && (
                        <span className="text-xs text-gray-500">
                          {new Date(report.effectiveDateTime).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
          </SectionCard>

          {/* Service Requests */}
          <SectionCard
            title="Service Requests"
            count={serviceRequests.length}
            icon={ScrollText}
            isLoading={loading.serviceRequests}
            error={errors?.serviceRequests}
            isEmpty={!loading.serviceRequests && serviceRequests.length === 0}
            emptyMessage="No service requests"
            onRetry={refetchers?.serviceRequests}
            skeletonVariant="list"
          >
              <div className="space-y-2">
                {serviceRequests.map((request, index) => (
                  <div key={request.id || index} className="border-l-2 border-orange-200 pl-3 py-1">
                    <p className="font-medium text-gray-900">
                      {request.code?.text || request.code?.coding?.[0]?.display || 'Service Request'}
                    </p>
                    {request.status && (
                      <Badge variant={request.status === 'completed' ? 'success' : 'warning'}>
                        {request.status}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
          </SectionCard>

          {/* Insurance Coverage */}
          <SectionCard
            title="Insurance Coverage"
            count={coverage.length}
            icon={Shield}
            isLoading={loading.coverage}
            error={errors?.coverage}
            isEmpty={!loading.coverage && coverage.length === 0}
            emptyMessage="No insurance information"
            onRetry={refetchers?.coverage}
            skeletonVariant="card"
          >
              <div className="space-y-3">
                {coverage.map((cov, index) => (
                  <div key={cov.id || index} className="bg-blue-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-gray-900">
                        {cov.type?.text || cov.type?.coding?.[0]?.display || 'Insurance Plan'}
                      </p>
                      {cov.status && (
                        <Badge variant={cov.status === 'active' ? 'success' : 'info'}>
                          {cov.status}
                        </Badge>
                      )}
                    </div>
                    {cov.subscriberId && (
                      <p className="text-sm text-gray-600">
                        Subscriber ID: {cov.subscriberId}
                      </p>
                    )}
                    {cov.period?.start && (
                      <p className="text-xs text-gray-500 mt-1">
                        Since: {new Date(cov.period.start).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
          </SectionCard>
        </div>
      </div>
    </Layout>
  );
}
