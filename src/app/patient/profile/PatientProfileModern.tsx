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
import { formatDateForDisplay } from '@/lib/timezone';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Heart,
  DollarSign,
  CreditCard,
  FileText,
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
  
  // State for showing all procedures (must be at component top level, before all other hooks)
  const [showAllProcedures, setShowAllProcedures] = React.useState(false);
  
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
    const [isOpen, setIsOpen] = React.useState(defaultOpen);

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
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="shadow-md border-gray-200 mb-2">
          <CollapsibleTrigger asChild>
            <CardHeader className="hover:bg-gray-50 transition-colors cursor-pointer p-3">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 flex items-center justify-center bg-blue-100 rounded-xl text-primary shadow-sm">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <CardTitle className="text-base">{title}</CardTitle>
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
                <ChevronDown
                  className={`w-6 h-6 text-gray-400 transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="p-3">
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
              {/* Patient Name and ID Skeleton */}
              <div className="mb-6">
                <Skeleton className="h-8 w-56 mb-2" />
                <Skeleton className="h-4 w-32" />
              </div>

              {/* Other Info Skeleton */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
                <div className="space-y-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
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
              {/* Patient Name and ID - Outside Grid */}
              <div className="mb-6">
                <h1 className="text-xl font-semibold text-gray-900 mb-1">{patientName}</h1>
                {patient?.id && (
                  <p className="text-xs text-gray-500 font-mono">
                    Patient ID: {patient.id}
                  </p>
                )}
              </div>

              {/* Other Information - Inside Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                {/* Left Column */}
                <div className="space-y-3">
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

        {/* Tab Navigation */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 h-auto p-0 bg-gray-100 rounded-xl shadow-sm">
            <TabsTrigger 
              value="overview" 
              className="flex items-center justify-center gap-2 py-2 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-blue-600 transition-all duration-200 hover:bg-gray-50 font-medium text-sm"
            >
              <Heart className="w-5 h-5" />
              <span className="hidden sm:inline">Health Overview</span>
              <span className="sm:hidden">Health</span>
            </TabsTrigger>
            <TabsTrigger 
              value="billing" 
              className="flex items-center justify-center gap-2 py-2 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-green-600 transition-all duration-200 hover:bg-gray-50 font-medium text-sm"
            >
              <DollarSign className="w-5 h-5" />
              <span className="hidden sm:inline">Insurance & Billing</span>
              <span className="sm:hidden">Billing</span>
            </TabsTrigger>
          </TabsList>

          {/* Health Overview Tab */}
          <TabsContent value="overview" className="mt-0">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {conditions.map((condition, index) => {
                // Find related procedures that reference this condition
                const relatedProcedures = procedures.filter(proc =>
                  proc.reasonReference?.some(ref =>
                    ref.reference === `Condition/${condition.id}`
                  )
                );
                
                // Get earliest procedure date as a proxy for condition date
                const earliestProcedureDate = relatedProcedures.length > 0
                  ? relatedProcedures
                      .map(p => p.performedDateTime || p.performedPeriod?.start)
                      .filter(Boolean)
                      .sort()[0]
                  : null;
                
                return (
                <div key={condition.id || index} className="bg-blue-50 border-l-4 border-blue-400 rounded-r-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <p className="font-semibold text-gray-900 text-base leading-tight">
                      {condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown Condition'}
                    </p>
                    {condition.clinicalStatus?.coding?.[0]?.code && (
                      <Badge variant={condition.clinicalStatus.coding[0].code === 'active' ? 'warning' : 'info'} className="text-xs px-2 py-0.5 flex-shrink-0">
                        {condition.clinicalStatus.coding[0].code}
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1.5 text-sm text-gray-600 mt-2">
                    {condition.recordedDate ? (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        <span className="font-medium">Diagnosed: {formatDateForDisplay(condition.recordedDate)}</span>
                      </div>
                    ) : condition.onsetDateTime ? (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        <span className="font-medium">Onset: {new Date(condition.onsetDateTime).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}</span>
                      </div>
                    ) : earliestProcedureDate ? (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        <span className="font-medium">Related procedure: {new Date(earliestProcedureDate).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}</span>
                      </div>
                    ) : condition.meta?.lastUpdated ? (
                      <div className="flex items-center gap-2 text-gray-500">
                        <Calendar className="w-4 h-4" />
                        <span className="text-xs">Last updated: {new Date(condition.meta.lastUpdated).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}</span>
                      </div>
                    ) : null}
                    {condition.onsetDateTime && condition.recordedDate && (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-orange-600" />
                        <span>Symptoms started: {new Date(condition.onsetDateTime).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}</span>
                      </div>
                    )}
                    {relatedProcedures.length > 0 && (
                      <div className="flex items-center gap-2 text-purple-600">
                        <Activity className="w-4 h-4" />
                        <span className="text-xs">{relatedProcedures.length} related procedure{relatedProcedures.length > 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {condition.verificationStatus?.coding?.[0]?.code && (
                      <div className="flex items-center gap-2 text-xs mt-2">
                        <span className="text-gray-500">Verification: <span className="font-medium text-gray-700 capitalize">{condition.verificationStatus.coding[0].code}</span></span>
                      </div>
                    )}
                    {condition.id && (
                      <div className="text-xs text-gray-400 mt-2 truncate" title={condition.id}>
                        ID: {condition.id}
                      </div>
                    )}
                  </div>
                </div>
              );
              })}
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
                          <Calendar className="w-3.5 h-3.5 text-blue-600" />
                          <span className="font-medium">Prescribed: {new Date(med.authoredOn).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}</span>
                        </div>
                      )}
                      {linkedEncounter && (
                        <div className="flex items-center gap-1.5 text-blue-600">
                          <Activity className="w-3.5 h-3.5" />
                          <span>
                            Visit: {linkedEncounter.period?.start
                              ? new Date(linkedEncounter.period.start).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })
                              : 'Unknown date'}
                          </span>
                        </div>
                      )}
                      {med.dispenseRequest?.validityPeriod?.start && med.dispenseRequest?.validityPeriod?.end && (
                        <div className="flex items-center gap-1.5 text-indigo-600">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            Valid: {new Date(med.dispenseRequest.validityPeriod.start).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })} - {new Date(med.dispenseRequest.validityPeriod.end).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                      )}
                      {relatedDispenses.length > 0 && (
                        <>
                          <div className="flex items-center gap-1.5 text-purple-600">
                            <Pill className="w-3.5 h-3.5" />
                            <span className="font-medium">
                              Dispensed: {new Date(relatedDispenses[0].whenHandedOver || relatedDispenses[0].whenPrepared || '').toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                          {relatedDispenses[0].quantity?.value && (
                            <div className="flex items-center gap-1.5 text-gray-600">
                              <span className="ml-5 text-xs">
                                Quantity: {relatedDispenses[0].quantity.value} {relatedDispenses[0].quantity.unit || 'units'}
                              </span>
                            </div>
                          )}
                          {relatedDispenses[0].daysSupply?.value && (
                            <div className="flex items-center gap-1.5 text-gray-600">
                              <span className="ml-5 text-xs">
                                Supply: {relatedDispenses[0].daysSupply.value} {relatedDispenses[0].daysSupply.unit || 'days'}
                              </span>
                            </div>
                          )}
                        </>
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
              {(() => {
                // Group procedures by year
                const proceduresByYear = procedures.reduce((acc, proc) => {
                  const date = proc.performedDateTime || proc.performedPeriod?.start;
                  const year = date ? new Date(date).getFullYear() : 'Unknown';
                  if (!acc[year]) acc[year] = [];
                  acc[year].push(proc);
                  return acc;
                }, {} as Record<string, typeof procedures>);

                // Sort years descending
                const sortedYears = Object.keys(proceduresByYear).sort((a, b) => {
                  if (a === 'Unknown') return 1;
                  if (b === 'Unknown') return -1;
                  return Number(b) - Number(a);
                });

                const displayLimit = 10;
                const shouldShowButton = procedures.length > displayLimit;

                return (
                  <div className="space-y-6">
                    {sortedYears.map((year, yearIndex) => {
                      const yearProcedures = proceduresByYear[year];
                      
                      // Sort procedures by date within year (most recent first)
                      const sortedProcedures = yearProcedures.sort((a, b) => {
                        const dateA = new Date(a.performedDateTime || a.performedPeriod?.start || 0);
                        const dateB = new Date(b.performedDateTime || b.performedPeriod?.start || 0);
                        return dateB.getTime() - dateA.getTime();
                      });

                      // Calculate how many procedures from this year to show
                      let proceduresToShow = sortedProcedures;
                      if (!showAllProcedures && shouldShowButton) {
                        const previousYearsCount = sortedYears
                          .slice(0, yearIndex)
                          .reduce((sum, y) => sum + proceduresByYear[y].length, 0);
                        
                        if (previousYearsCount >= displayLimit) {
                          return null; // Don't show this year at all
                        }
                        
                        const remainingSlots = displayLimit - previousYearsCount;
                        proceduresToShow = sortedProcedures.slice(0, remainingSlots);
                      }

                      if (proceduresToShow.length === 0) return null;

                      return (
                        <div key={year}>
                          {/* Year Header */}
                          <div className="flex items-center gap-3 mb-3">
                            <div className="flex-1 h-px bg-gradient-to-r from-purple-200 to-transparent"></div>
                            <h3 className="text-sm font-semibold text-purple-700 bg-purple-50 px-3 py-1 rounded-full">
                              {year} ({yearProcedures.length} procedure{yearProcedures.length > 1 ? 's' : ''})
                            </h3>
                            <div className="flex-1 h-px bg-gradient-to-l from-purple-200 to-transparent"></div>
                          </div>

                          {/* Procedures for this year */}
                          <div className="space-y-3">
                            {proceduresToShow.map((proc, index) => {
                              // Try to find related condition
                              const relatedCondition = proc.reasonReference?.find(ref => 
                                ref.reference?.startsWith('Condition/')
                              );
                              const conditionId = relatedCondition?.reference?.replace('Condition/', '');
                              const linkedCondition = conditionId ? conditions.find(c => c.id === conditionId) : null;
                              
                              // Try to find related encounter
                              const encounterId = proc.encounter?.reference?.replace('Encounter/', '');
                              const linkedEncounter = encounterId ? encounters.find(e => e.id === encounterId) : null;
                              
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
                            <Calendar className="w-4 h-4 text-blue-600" />
                            <span className="font-medium">
                              Performed: {proc.performedDateTime 
                                ? new Date(proc.performedDateTime).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })
                                : proc.performedPeriod?.start 
                                  ? new Date(proc.performedPeriod.start).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  })
                                  : 'Unknown date'}
                            </span>
                          </div>
                        )}
                        {linkedEncounter && linkedEncounter.period?.start && (
                          <div className="flex items-center gap-2 text-indigo-600">
                            <Activity className="w-4 h-4" />
                            <span>
                              Visit: {new Date(linkedEncounter.period.start).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
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
                      </div>
                    </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {/* Show More/Less Button */}
                    {shouldShowButton && (
                      <div className="flex justify-center pt-4">
                        <button
                          onClick={() => setShowAllProcedures(!showAllProcedures)}
                          className="flex items-center gap-2 px-6 py-3 bg-purple-50 hover:bg-purple-100 text-purple-700 font-medium rounded-lg transition-colors border-2 border-purple-200 hover:border-purple-300"
                        >
                          {showAllProcedures ? (
                            <>
                              <ChevronDown className="w-4 h-4 rotate-180" />
                              Show Less
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-4 h-4" />
                              Show {procedures.length - displayLimit} More Procedures
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
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
        </div>
          </TabsContent>

          {/* Insurance & Billing Tab */}
          <TabsContent value="billing" className="mt-0">
            <div className="space-y-3">
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
            defaultOpen={true}
            skeletonVariant="card"
          >
              <div className="space-y-4">
                {coverage.map((cov, index) => {
                  // Check if coverage is expired
                  const endDate = cov.period?.end ? new Date(cov.period.end) : null;
                  const isExpired = endDate && endDate < new Date();
                  
                  return (
                  <div key={cov.id || index} className={`rounded-lg p-4 border-2 ${
                    isExpired ? 'bg-red-50 border-red-300' : 'bg-blue-50 border-blue-300'
                  }`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          isExpired ? 'bg-red-200' : 'bg-blue-200'
                        }`}>
                          <Shield className={`w-6 h-6 ${isExpired ? 'text-red-700' : 'text-blue-700'}`} />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-base">
                            {cov.type?.text || cov.type?.coding?.[0]?.display || 'Insurance Plan'}
                          </p>
                          <p className="text-sm text-gray-600">
                            {cov.policyHolder?.display || 'Insurance Holder'}
                          </p>
                        </div>
                      </div>
                      {cov.status && (
                        <Badge variant={
                          isExpired ? 'danger' : 
                          cov.status === 'active' ? 'success' : 'info'
                        } className="text-xs">
                          {isExpired ? 'Expired' : cov.status}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      {cov.subscriberId && (
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-gray-600" />
                          <span className="text-gray-700">
                            Subscriber ID: <span className="font-medium">{cov.subscriberId}</span>
                          </span>
                        </div>
                      )}
                      {cov.period?.start && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-600" />
                          <span className="text-gray-700">
                            Coverage Period: <span className="font-medium">
                              {new Date(cov.period.start).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                              {cov.period.end && ` - ${new Date(cov.period.end).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}`}
                            </span>
                          </span>
                        </div>
                      )}
                      {cov.relationship?.coding?.[0]?.display && (
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-600" />
                          <span className="text-gray-700">
                            Relationship: <span className="font-medium capitalize">{cov.relationship.coding[0].display}</span>
                          </span>
                        </div>
                      )}
                      {isExpired && (
                        <div className="mt-3 p-2 bg-red-100 rounded border border-red-200">
                          <p className="text-xs text-red-800 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            This insurance coverage has expired. Please update your insurance information.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
          </SectionCard>

          {/* Claims History (EOB) */}
          <SectionCard
            title="Claims History"
            count={explanationOfBenefit.length}
            icon={FileText}
            isLoading={loading.explanationOfBenefit}
            error={errors?.explanationOfBenefit}
            isEmpty={!loading.explanationOfBenefit && explanationOfBenefit.length === 0}
            emptyMessage="No claims records"
            onRetry={refetchers?.explanationOfBenefit}
            defaultOpen={true}
            skeletonVariant="list"
          >
              <div className="space-y-4">
                {explanationOfBenefit
                  .sort((a, b) => {
                    const dateA = new Date(a.created || a.billablePeriod?.start || 0);
                    const dateB = new Date(b.created || b.billablePeriod?.start || 0);
                    return dateB.getTime() - dateA.getTime();
                  })
                  .map((eob, index) => {
                    const claimDate = eob.created || eob.billablePeriod?.start;
                    const paymentAmount = eob.payment?.amount?.value;
                    const paymentDate = eob.payment?.date;
                    
                    return (
                  <div key={eob.id || index} className="bg-white rounded-lg border-2 border-gray-200 p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-semibold text-gray-900">
                            {eob.type?.coding?.[0]?.display || 'Medical Claim'}
                          </p>
                          {eob.outcome && (
                            <Badge variant={eob.outcome === 'complete' ? 'success' : 'warning'} className="text-xs">
                              {eob.outcome}
                            </Badge>
                          )}
                        </div>
                        {claimDate && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4" />
                            <span>Service Date: {new Date(claimDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}</span>
                          </div>
                        )}
                      </div>
                      {paymentAmount !== undefined && (
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-600">
                            ${paymentAmount.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {eob.payment?.amount?.currency || 'USD'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Service Items */}
                    {eob.item && eob.item.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs font-medium text-gray-700 mb-2">Services:</p>
                        <div className="space-y-1">
                          {eob.item.slice(0, 3).map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs text-gray-600">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                              <span>{item.revenue?.coding?.[0]?.display || `Service ${item.sequence}`}</span>
                            </div>
                          ))}
                          {eob.item.length > 3 && (
                            <p className="text-xs text-gray-500 ml-3.5">
                              +{eob.item.length - 3} more services
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Payment Info */}
                    {paymentDate && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <DollarSign className="w-3.5 h-3.5 text-green-600" />
                          <span>Paid on {new Date(paymentDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}</span>
                        </div>
                      </div>
                    )}

                    {/* Diagnosis Reference */}
                    {eob.diagnosis && eob.diagnosis.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500">
                          Diagnosis: {eob.diagnosis.length} condition{eob.diagnosis.length > 1 ? 's' : ''}
                        </p>
                      </div>
                    )}
                  </div>
                    );
                  })}
              </div>
          </SectionCard>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
