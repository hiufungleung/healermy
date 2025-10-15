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
        <Card>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="hover:bg-gray-50 transition-colors cursor-pointer">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 flex items-center justify-center bg-blue-50 rounded-lg text-primary">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <CardTitle className="text-sm sm:text-base">{title}</CardTitle>
                    {count !== undefined && !isLoading && (
                      <p className="text-xs text-gray-500">
                        {count} {count === 1 ? 'record' : 'records'}
                      </p>
                    )}
                    {isLoading && (
                      <p className="text-xs text-gray-400">Loading...</p>
                    )}
                  </div>
                </div>
                <ChevronDown className="w-5 h-5 text-gray-400 transition-transform" />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {renderContent()}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Patient Header - Compact Two Column Layout */}
        {loading.patient || !patientName ? (
          // Show skeleton during patient data loading
          <div className="bg-gradient-to-br from-gray-300 to-gray-400 rounded-2xl p-4 sm:p-6 mb-4 shadow-lg animate-pulse">
            <div className="flex items-start gap-4">
              <Skeleton className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/30" />
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-3">
                <div className="space-y-2">
                  <Skeleton className="h-7 w-48 bg-white/30" />
                  <Skeleton className="h-4 w-32 bg-white/20" />
                  <Skeleton className="h-4 w-28 bg-white/20" />
                  <Skeleton className="h-4 w-24 bg-white/20" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-36 bg-white/20" />
                  <Skeleton className="h-4 w-48 bg-white/20" />
                  <Skeleton className="h-4 w-44 bg-white/20" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 sm:p-6 mb-4 shadow-lg">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl sm:text-3xl font-bold text-white flex-shrink-0">
                {patientName?.[0]?.toUpperCase() || 'P'}
              </div>

              {/* Two Column Content */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-3">
                {/* Left Column */}
                <div className="space-y-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">{patientName}</h1>
                  {age && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-white/80" />
                      <span className="text-sm text-white/90">{age} years old</span>
                    </div>
                  )}
                  {gender && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-white/80" />
                      <span className="text-sm text-white/90 capitalize">{gender}</span>
                    </div>
                  )}
                  {bloodType && (
                    <div className="flex items-center gap-2">
                      <Droplet className="w-4 h-4 text-white/80" />
                      <span className="text-sm text-white/90">Blood Type: {bloodType}</span>
                    </div>
                  )}
                </div>

                {/* Right Column */}
                <div className="space-y-2">
                  {phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-white/80" />
                      <span className="text-sm text-white/90">{phone}</span>
                    </div>
                  )}
                  {email ? (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-white/80" />
                      <span className="text-sm text-white/90 truncate">{email}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-white/80" />
                      <span className="text-sm text-white/60">Email not available</span>
                    </div>
                  )}
                  {address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-white/80 mt-0.5" />
                      <span className="text-sm text-white/90">{address}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Allergies Alert - Always Visible if present */}
        {!loading.patient && allergies.length > 0 && (
          <Card className="bg-red-50 border-l-4 border-red-500 mb-4">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
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
            </CardContent>
          </Card>
        )}

        {/* Vital Signs */}
        {latestVitals.length > 0 && (
          <Card className="mb-4">
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
                    <p className="text-lg font-semibold text-primary">
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
            <div className="space-y-2">
              {conditions.map((condition, index) => (
                <div key={condition.id || index} className="border-l-2 border-blue-200 pl-3 py-1">
                  <p className="font-medium text-gray-900">
                    {condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown Condition'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {condition.clinicalStatus?.coding?.[0]?.code && (
                      <Badge variant={condition.clinicalStatus.coding[0].code === 'active' ? 'warning' : 'info'}>
                        {condition.clinicalStatus.coding[0].code}
                      </Badge>
                    )}
                    {condition.onsetDateTime && (
                      <span className="text-xs text-gray-500">
                        Onset: {new Date(condition.onsetDateTime).toLocaleDateString()}
                      </span>
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
            <div className="space-y-2">
              {medications.map((med, index) => (
                <div key={med.id || index} className="border-l-2 border-green-200 pl-3 py-1">
                  <p className="font-medium text-gray-900">
                    {med.medicationCodeableConcept?.text ||
                     med.medicationCodeableConcept?.coding?.[0]?.display ||
                     'Unknown Medication'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {med.status && (
                      <Badge variant={med.status === 'active' ? 'success' : 'info'}>
                        {med.status}
                      </Badge>
                    )}
                    {med.dosageInstruction?.[0]?.text && (
                      <span className="text-xs text-gray-600">
                        {med.dosageInstruction[0].text}
                      </span>
                    )}
                  </div>
                </div>
              ))}
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
            emptyMessage="No procedures recorded"
            onRetry={refetchers?.procedures}
            skeletonVariant="list"
          >
              <div className="space-y-2">
                {procedures.map((proc, index) => (
                  <div key={proc.id || index} className="border-l-2 border-purple-200 pl-3 py-1">
                    <p className="font-medium text-gray-900">
                      {proc.code?.text || proc.code?.coding?.[0]?.display || 'Unknown Procedure'}
                    </p>
                    {proc.performedDateTime && (
                      <span className="text-xs text-gray-500">
                        {new Date(proc.performedDateTime).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                ))}
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
