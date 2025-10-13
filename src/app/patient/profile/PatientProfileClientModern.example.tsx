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
  Procedure,
  FamilyMemberHistory,
  DiagnosticReport,
  ServiceRequest,
  Coverage,
  ExplanationOfBenefit,
} from '@/types/fhir';
import { PatientHero } from '@/components/patient/PatientHero';
import { HealthSnapshot } from '@/components/patient/HealthSnapshot';
import { StickyProfileNav, ProfileSection } from '@/components/patient/StickyProfileNav';
import { ClinicalTimeline, TimelineEvent } from '@/components/patient/ClinicalTimeline';
import { InsuranceOverview } from '@/components/patient/InsuranceOverview';
import { VitalsDashboard } from '@/components/patient/VitalsDashboard';
import { CriticalAlerts } from '@/components/patient/CriticalAlerts';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { HealthOverview } from '@/components/patient/HealthOverview';
import { EncountersOverview } from '@/components/patient/EncountersOverview';

const INITIAL_DISPLAY_COUNT = 5;

type SectionId = 'overview' | 'timeline' | 'treatments' | 'labs' | 'documents' | 'insurance';

interface ModernPatientProfileLayoutProps {
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
  accounts?: any[];
  accountOrganizations?: Record<string, any>;
  encounterPractitioners: Record<string, any>;
  encounterConditions?: Record<string, any>;
  encounterAccounts?: Record<string, any>;
  phone?: string;
  email?: string;
  address?: string;
  bloodType?: string;
  loading: Record<string, boolean>;
  errors: Record<string, string>;
  refetchers: Record<string, () => void>;
}

export function ModernPatientProfileLayout({
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
  accounts = [],
  accountOrganizations = {},
  encounterPractitioners,
  encounterConditions = {},
  encounterAccounts = {},
  phone,
  email,
  address,
  bloodType,
  loading,
  errors,
  refetchers,
}: ModernPatientProfileLayoutProps) {
  const [showAllConditions, setShowAllConditions] = useState(false);
  const [showAllMedications, setShowAllMedications] = useState(false);
  const [showAllFamilyHistory, setShowAllFamilyHistory] = useState(false);
  const [showAllObservations, setShowAllObservations] = useState(false);
  const [showAllDiagnosticReports, setShowAllDiagnosticReports] = useState(false);
  const [showAllServiceRequests, setShowAllServiceRequests] = useState(false);

  const sections: ProfileSection[] = useMemo(
    () => [
      {
        id: 'overview',
        label: 'Overview',
        icon: (
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
        ),
      },
      {
        id: 'timeline',
        label: 'Timeline',
        icon: (
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
              clipRule="evenodd"
            />
          </svg>
        ),
      },
      {
        id: 'treatments',
        label: 'Treatments',
        icon: (
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 3.5a1.5 1.5 0 013 0V4a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-.5a1.5 1.5 0 000 3h.5a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-.5a1.5 1.5 0 00-3 0v.5a1 1 0 01-1 1H6a1 1 0 01-1-1v-3a1 1 0 00-1-1h-.5a1.5 1.5 0 010-3H4a1 1 0 001-1V6a1 1 0 011-1h3a1 1 0 001-1v-.5z" />
          </svg>
        ),
      },
      {
        id: 'labs',
        label: 'Labs & Orders',
        icon: (
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M7 2a1 1 0 00-.707 1.707L7 4.414v3.758a1 1 0 01-.293.707l-4 4C.817 14.769 2.156 18 4.828 18h10.343c2.673 0 4.012-3.231 2.122-5.121l-4-4A1 1 0 0113 8.172V4.414l.707-.707A1 1 0 0013 2H7zm2 6.172V4h2v4.172a3 3 0 00.879 2.12l1.027 1.028a4 4 0 00-2.171.102l-.47.156a4 4 0 01-2.53 0l-.563-.187a1.993 1.993 0 00-.114-.035l1.063-1.063A3 3 0 009 8.172z"
              clipRule="evenodd"
            />
          </svg>
        ),
      },
      {
        id: 'documents',
        label: 'History & Notes',
        icon: (
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M5 4a2 2 0 012-2h4.586a2 2 0 011.414.586l2.414 2.414A2 2 0 0116 6.414V16a2 2 0 01-2 2H7a2 2 0 01-2-2V4zm5 5a1 1 0 00-2 0v3a1 1 0 002 0V9zm0 5a1 1 0 10-2 0 1 1 0 002 0z"
              clipRule="evenodd"
            />
          </svg>
        ),
      },
      {
        id: 'insurance',
        label: 'Insurance',
        icon: (
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
            <path
              fillRule="evenodd"
              d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"
              clipRule="evenodd"
            />
          </svg>
        ),
      },
    ],
    []
  );

  const snapshotMetrics = useMemo(() => {
    const activeConditionsCount = conditions.filter(
      (condition) => condition.clinicalStatus?.coding?.[0]?.code === 'active'
    ).length;

    const criticalAllergiesCount = allergies.filter((allergy) => allergy.criticality === 'high').length;

    const sortedEncounters = [...encounters].sort((a, b) => {
      const dateA = new Date(a.period?.start || 0).getTime();
      const dateB = new Date(b.period?.start || 0).getTime();
      return dateB - dateA;
    });

    const lastVisitDate =
      sortedEncounters.length > 0 && sortedEncounters[0].period?.start
        ? new Date(sortedEncounters[0].period.start).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : null;

    const careTeamSize = new Set(
      Object.values(encounterPractitioners).map((practitioner: any) => practitioner?.id ?? practitioner)
    ).size;

    return {
      activeConditionsCount,
      criticalAllergiesCount,
      lastVisitDate,
      careTeamSize,
    };
  }, [allergies, conditions, encounterPractitioners, encounters]);

  const timelineEvents: TimelineEvent[] = useMemo(() => {
    const events: TimelineEvent[] = [];

    encounters.forEach((encounter: any) => {
      if (encounter.period?.start) {
        events.push({
          id: encounter.id || '',
          type: 'encounter',
          date: encounter.period.start,
          title:
            encounter.type?.[0]?.text ||
            encounter.type?.[0]?.coding?.[0]?.display ||
            'Medical Visit',
          description: encounter.reasonCode?.[0]?.text || undefined,
          status: encounter.status,
          practitioner: encounterPractitioners[encounter.id || '']?.name,
          location: encounter.location?.[0]?.location?.display,
        });
      }
    });

    procedures.forEach((procedure: any) => {
      const date = procedure.performedDateTime || procedure.performedPeriod?.start;
      if (date) {
        events.push({
          id: procedure.id || '',
          type: 'procedure',
          date,
          title:
            procedure.code?.text ||
            procedure.code?.coding?.[0]?.display ||
            'Procedure',
          description: procedure.note?.[0]?.text || undefined,
          status: procedure.status,
          category: procedure.category?.text,
        });
      }
    });

    diagnosticReports.forEach((report: any) => {
      if (report.effectiveDateTime) {
        events.push({
          id: report.id || '',
          type: 'diagnostic',
          date: report.effectiveDateTime,
          title:
            report.code?.text ||
            report.code?.coding?.[0]?.display ||
            'Diagnostic Report',
          status: report.status,
          category: report.category?.[0]?.text,
        });
      }
    });

    serviceRequests.forEach((request: any) => {
      if (request.authoredOn) {
        events.push({
          id: request.id || '',
          type: 'service-request',
          date: request.authoredOn,
          title:
            request.code?.text ||
            request.code?.coding?.[0]?.display ||
            'Service Request',
          status: request.status,
          category: request.category?.[0]?.text,
        });
      }
    });

    return events.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [diagnosticReports, encounters, encounterPractitioners, procedures, serviceRequests]);

  const medicationGroups = useMemo(() => {
    const grouped: Record<
      string,
      { name: string; code: string; dispenses: MedicationDispense[] }
    > = {};

    medicationDispenses.forEach((dispense) => {
      const medName =
        dispense.medicationCodeableConcept?.text ||
        dispense.medicationCodeableConcept?.coding?.[0]?.display ||
        'Unknown Medication';
      const medCode = dispense.medicationCodeableConcept?.coding?.[0]?.code || '';
      const key = `${medName}_${medCode}`;

      if (!grouped[key]) {
        grouped[key] = { name: medName, code: medCode, dispenses: [] };
      }
      grouped[key].dispenses.push(dispense);
    });

    return Object.values(grouped)
      .map((group) => ({
        ...group,
        dispenses: [...group.dispenses].sort((a, b) => {
          const dateA = a.whenHandedOver ? new Date(a.whenHandedOver).getTime() : 0;
          const dateB = b.whenHandedOver ? new Date(b.whenHandedOver).getTime() : 0;
          return dateB - dateA;
        }),
      }))
      .sort((a, b) => {
        const latestA = a.dispenses[0]?.whenHandedOver
          ? new Date(a.dispenses[0].whenHandedOver).getTime()
          : 0;
        const latestB = b.dispenses[0]?.whenHandedOver
          ? new Date(b.dispenses[0].whenHandedOver).getTime()
          : 0;
        return latestB - latestA;
      });
  }, [medicationDispenses]);

  const observationTests = useMemo(() => {
    const grouped = observations.reduce(
      (acc: Record<string, { testName: string; loincCode: string; category: string; observations: Observation[] }>, obs) => {
        const testName =
          obs.code?.text || obs.code?.coding?.[0]?.display || 'Observation';
        const loincCode =
          obs.code?.coding?.find((coding) => coding.system === 'http://loinc.org')
            ?.code || '';
        const category =
          obs.category?.[0]?.text ||
          obs.category?.[0]?.coding?.[0]?.display ||
          'Other';
        const key = `${testName}_${loincCode}`;

        if (!acc[key]) {
          acc[key] = { testName, loincCode, category, observations: [] };
        }
        acc[key].observations.push(obs);
        return acc;
      },
      {}
    );

    return Object.values(grouped)
      .map((group) => ({
        ...group,
        observations: [...group.observations].sort((a, b) => {
          const dateA = a.effectiveDateTime ? new Date(a.effectiveDateTime).getTime() : 0;
          const dateB = b.effectiveDateTime ? new Date(b.effectiveDateTime).getTime() : 0;
          return dateB - dateA;
        }),
      }))
      .sort((a, b) => {
        const dateA = a.observations[0]?.effectiveDateTime
          ? new Date(a.observations[0].effectiveDateTime!).getTime()
          : 0;
        const dateB = b.observations[0]?.effectiveDateTime
          ? new Date(b.observations[0].effectiveDateTime!).getTime()
          : 0;
        return dateB - dateA;
      });
  }, [observations]);

  const diagnosticList = useMemo(
    () =>
      [...diagnosticReports].sort((a, b) => {
        const dateA = a.effectiveDateTime ? new Date(a.effectiveDateTime).getTime() : 0;
        const dateB = b.effectiveDateTime ? new Date(b.effectiveDateTime).getTime() : 0;
        return dateB - dateA;
      }),
    [diagnosticReports]
  );

  const serviceRequestsList = useMemo(
    () =>
      [...serviceRequests].sort((a, b) => {
        const dateA = a.authoredOn ? new Date(a.authoredOn).getTime() : 0;
        const dateB = b.authoredOn ? new Date(b.authoredOn).getTime() : 0;
        return dateB - dateA;
      }),
    [serviceRequests]
  );

  const scrollToSection = (section: SectionId) => {
    const element = document.getElementById(section);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const renderLoadingSpinner = () => (
    <div className="ml-3 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  );

  const renderError = (message: string, retryKey?: string) => (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <div className="flex items-center justify-between">
        <span>{message}</span>
        {retryKey && refetchers[retryKey] && (
          <Button variant="outline" size="sm" onClick={refetchers[retryKey]}>
            Retry
          </Button>
        )}
      </div>
    </div>
  );

  const renderContactCard = () => (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary">Contact & Location</h3>
        {loading.patient && renderLoadingSpinner()}
      </div>
      <div className="mt-4 space-y-3 text-sm text-text-secondary">
        {errors.patient
          ? renderError(errors.patient, 'patient')
          : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Email
                </p>
                <p className="mt-1 font-semibold text-text-primary">
                  {email || 'No email provided'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Phone
                </p>
                <p className="mt-1 font-semibold text-text-primary">
                  {phone || 'No phone provided'}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Address
                </p>
                <p className="mt-1 font-semibold text-text-primary">
                  {address || 'No address provided'}
                </p>
              </div>
            </div>
          )}
      </div>
    </Card>
  );

  const renderAllergiesCard = () => (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary">Allergies & Intolerances</h3>
        {loading.allergies && renderLoadingSpinner()}
      </div>
      {errors.allergies
        ? renderError(errors.allergies, 'allergies')
        : allergies.length > 0
        ? (
          <div className="space-y-3">
            {allergies.map((allergy) => {
              const isHighRisk = allergy.criticality === 'high';
              const isActive =
                allergy.clinicalStatus?.coding?.[0]?.code === 'active';

              return (
                <div
                  key={allergy.id}
                  className="rounded-md border border-red-200 bg-red-50/60 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-text-primary">
                        {allergy.code?.text ||
                          allergy.code?.coding?.[0]?.display ||
                          'Unknown Allergen'}
                      </p>
                      {allergy.reaction && allergy.reaction.length > 0 && (
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-secondary">
                          {allergy.reaction.map((reaction, index) => (
                            <li key={index}>
                              {reaction.manifestation
                                ?.map(
                                  (manifestation: any) =>
                                    manifestation.text ||
                                    manifestation.coding?.[0]?.display
                                )
                                .filter(Boolean)
                                .join(', ') || 'Reaction recorded'}
                              {reaction.severity && (
                                <span className="ml-2 uppercase text-red-600">
                                  ({reaction.severity})
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {isHighRisk && (
                        <Badge variant="danger" size="sm">
                          High risk
                        </Badge>
                      )}
                      {isActive && (
                        <Badge variant="warning" size="sm">
                          Active
                        </Badge>
                      )}
                      {allergy.type && (
                        <span className="text-xs capitalize text-text-secondary">
                          {allergy.type}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
        : (
          <p className="text-sm text-text-secondary">
            No known allergies or intolerances.
          </p>
        )}
    </Card>
  );

  const renderConditionsCard = () => {
    const classifySeverity = (condition: Condition) => {
      const label =
        condition.code?.text ||
        condition.code?.coding?.[0]?.display ||
        '';
      const lower = label.toLowerCase();
      if (
        lower.includes('heart') ||
        lower.includes('stroke') ||
        lower.includes('cancer') ||
        lower.includes('diabetes') ||
        lower.includes('hypertension')
      ) {
        return 'high';
      }
      if (
        lower.includes('asthma') ||
        lower.includes('arthritis') ||
        lower.includes('depression')
      ) {
        return 'moderate';
      }
      return 'mild';
    };

    const grouped = {
      high: [] as Condition[],
      moderate: [] as Condition[],
      mild: [] as Condition[],
      inactive: [] as Condition[],
    };

    const severityStyles = {
      high: { badgeBg: 'bg-rose-50', badgeText: 'text-rose-700' },
      moderate: { badgeBg: 'bg-amber-50', badgeText: 'text-amber-700' },
      mild: { badgeBg: 'bg-sky-50', badgeText: 'text-sky-700' },
      inactive: { badgeBg: 'bg-gray-100', badgeText: 'text-gray-700' },
    };

    conditions.forEach((condition) => {
      const status = condition.clinicalStatus?.coding?.[0]?.code;
      if (status !== 'active') {
        grouped.inactive.push(condition);
        return;
      }
      grouped[classifySeverity(condition) as 'high' | 'moderate' | 'mild'].push(
        condition
      );
    });

    const renderGroup = (
      title: string,
      items: Condition[],
      style: { badgeBg: string; badgeText: string }
    ) =>
      items.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
            <h4 className="text-sm font-semibold text-text-primary">
              {title}
            </h4>
            <span className={`inline-flex h-6 items-center rounded-full px-3 text-xs font-semibold ${style.badgeBg} ${style.badgeText}`}>
              {items.length}
            </span>
          </div>
          <div className="divide-y divide-gray-100">
            {items.map((condition) => (
              <div key={condition.id} className="px-4 py-3 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-text-primary">
                      {condition.code?.text ||
                        condition.code?.coding?.[0]?.display ||
                        'Condition'}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-text-secondary">
                      {(condition as any).onsetDateTime && (
                        <span>
                          Since{' '}
                          {new Date(
                            (condition as any).onsetDateTime
                          ).toLocaleDateString()}
                        </span>
                      )}
                      {(condition as any).recordedDate && !(
                        condition as any
                      ).onsetDateTime && (
                        <span>
                          Recorded{' '}
                          {new Date(
                            (condition as any).recordedDate
                          ).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  {condition.clinicalStatus?.coding?.[0]?.code === 'active' && (
                    <Badge variant="warning" size="sm">
                      Active
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    return (
      <Card className="border border-gray-200 bg-white shadow-sm" data-section="conditions">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">Conditions</h3>
          {loading.conditions && renderLoadingSpinner()}
        </div>
        {errors.conditions
          ? renderError(errors.conditions, 'conditions')
          : conditions.length > 0
          ? (
            <div className="space-y-4">
              {renderGroup('High Priority', grouped.high, severityStyles.high)}
              {renderGroup('Managed Conditions', grouped.moderate, severityStyles.moderate)}
              {renderGroup('Routine', grouped.mild, severityStyles.mild)}
              {showAllConditions &&
                renderGroup('Resolved / Inactive', grouped.inactive, severityStyles.inactive)}

              {grouped.inactive.length > 0 && (
                <div className="text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllConditions((prev) => !prev)}
                  >
                    {showAllConditions ? 'Hide resolved conditions' : `Show resolved conditions (${grouped.inactive.length})`}
                  </Button>
                </div>
              )}
            </div>
          )
          : (
            <p className="text-sm text-text-secondary">
              No conditions recorded.
            </p>
          )}
      </Card>
    );
  };

  const renderMedicationsCard = () => (
    <Card className="border border-gray-200 bg-white shadow-sm" data-section="medications">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary">Medication History</h3>
        {loading.medications && renderLoadingSpinner()}
      </div>
      {errors.medications
        ? renderError(errors.medications, 'medications')
        : medicationGroups.length > 0
        ? (
          <div className="space-y-4">
            {(showAllMedications
              ? medicationGroups
              : medicationGroups.slice(0, INITIAL_DISPLAY_COUNT)
            ).map((medication) => {
              const mostRecent = medication.dispenses[0];
              return (
                <div
                  key={`${medication.name}_${medication.code}`}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-text-primary">{medication.name}</p>
                      {medication.code && (
                        <span className="mt-1 inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-600">
                          {medication.code}
                        </span>
                      )}
                    </div>
                    {mostRecent?.whenHandedOver && (
                      <span className="text-sm text-text-secondary">
                        Dispensed{' '}
                        {new Date(mostRecent.whenHandedOver).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 grid gap-3 text-sm text-text-secondary sm:grid-cols-3">
                    {mostRecent?.quantity && (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">
                          Quantity
                        </p>
                        <p className="mt-1 font-semibold text-text-primary">
                          {mostRecent.quantity.value}{' '}
                          {mostRecent.quantity.unit?.replace(/[{}]/g, '')}
                        </p>
                      </div>
                    )}
                    {mostRecent?.daysSupply && (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">
                          Supply
                        </p>
                        <p className="mt-1 font-semibold text-text-primary">
                          {mostRecent.daysSupply.value}{' '}
                          {mostRecent.daysSupply.unit}
                        </p>
                      </div>
                    )}
                    {mostRecent?.dosageInstruction?.[0]?.text && (
                      <div className="sm:col-span-3">
                        <p className="text-xs uppercase tracking-wide text-gray-500">
                          Instructions
                        </p>
                        <p className="mt-1 text-text-secondary">
                          {mostRecent.dosageInstruction[0].text}
                        </p>
                      </div>
                    )}
                  </div>
                  {medication.dispenses.length > 1 && (
                    <details className="mt-3 border-t border-gray-100 pt-3 text-sm text-text-secondary">
                      <summary className="cursor-pointer font-medium text-primary">
                        View earlier fills ({medication.dispenses.length - 1})
                      </summary>
                      <ul className="mt-2 space-y-2 pl-4">
                        {medication.dispenses.slice(1).map((dispense, index) => (
                          <li key={dispense.id || index} className="list-disc">
                            {dispense.whenHandedOver
                              ? new Date(dispense.whenHandedOver).toLocaleDateString()
                              : 'Unknown date'}
                            {dispense.quantity?.value && (
                              <span className="ml-2">
                                • {dispense.quantity.value}{' '}
                                {dispense.quantity.unit?.replace(/[{}]/g, '')}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              );
            })}

            {medicationGroups.length > INITIAL_DISPLAY_COUNT && (
              <div className="text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllMedications((prev) => !prev)}
                >
                  {showAllMedications
                    ? 'Show fewer medications'
                    : `Show all medications (${medicationGroups.length - INITIAL_DISPLAY_COUNT} more)`}
                </Button>
              </div>
            )}
          </div>
        )
        : (
          <p className="text-sm text-text-secondary">
            No medication history recorded.
          </p>
        )}
    </Card>
  );

  const renderFamilyHistoryCard = () => (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary">Family History</h3>
        {loading.familyHistory && renderLoadingSpinner()}
      </div>
      {errors.familyHistory
        ? renderError(errors.familyHistory, 'familyHistory')
        : familyHistory.length > 0
        ? (
          <div className="space-y-3">
            {(showAllFamilyHistory
              ? familyHistory
              : familyHistory.slice(0, INITIAL_DISPLAY_COUNT)
            ).map((family) => {
              const relation =
                family.relationship?.text ||
                family.relationship?.coding?.[0]?.display ||
                'Relative';
              const note = (family as any).note?.[0]?.text;
              return (
                <div
                  key={family.id}
                  className="rounded-md border border-gray-200 bg-white px-4 py-3 shadow-sm"
                >
                  <p className="font-semibold text-text-primary">{relation}</p>
                  {note && (
                    <p className="mt-1 text-sm text-text-secondary">
                      {note}
                    </p>
                  )}
                  {family.condition && family.condition.length > 0 && (
                    <ul className="mt-2 space-y-1 text-sm text-text-secondary">
                      {family.condition.map((condition, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                          <span>
                            {condition.code?.text ||
                              condition.code?.coding?.[0]?.display ||
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
              );
            })}
            {familyHistory.length > INITIAL_DISPLAY_COUNT && (
              <div className="text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllFamilyHistory((prev) => !prev)}
                >
                  {showAllFamilyHistory
                    ? 'Show fewer relatives'
                    : `Show all relatives (${familyHistory.length - INITIAL_DISPLAY_COUNT} more)`}
                </Button>
              </div>
            )}
          </div>
        )
        : (
          <p className="text-sm text-text-secondary">
            No family history recorded.
          </p>
        )}
    </Card>
  );

  const renderObservationsCard = () => (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary">Test Results & Observations</h3>
        {loading.observations && renderLoadingSpinner()}
      </div>
      {errors.observations
        ? renderError(errors.observations, 'observations')
        : observationTests.length > 0
        ? (
          <div className="space-y-4">
            {(showAllObservations
              ? observationTests
              : observationTests.slice(0, INITIAL_DISPLAY_COUNT)
            ).map((test) => {
              const mostRecent = test.observations[0];
              let valueDisplay = '';
              if (mostRecent?.valueQuantity) {
                valueDisplay = `${mostRecent.valueQuantity.value} ${mostRecent.valueQuantity.unit || ''}`;
              } else if (mostRecent?.valueString) {
                valueDisplay = mostRecent.valueString;
              } else if (mostRecent?.component?.length) {
                valueDisplay = mostRecent.component
                  .map((component) =>
                    component.valueQuantity?.value
                      ? `${component.valueQuantity.value} ${component.valueQuantity.unit || ''}`
                      : component.valueString || ''
                  )
                  .filter(Boolean)
                  .join(' / ');
              }

              return (
                <div key={`${test.testName}_${test.loincCode}`} className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-text-primary">{test.testName}</p>
                      <p className="text-sm text-text-secondary">
                        {test.category}
                        {test.loincCode && <span className="ml-2 font-mono text-xs text-gray-500">LOINC {test.loincCode}</span>}
                      </p>
                    </div>
                    {mostRecent?.status && (
                      <Badge variant={mostRecent.status === 'final' ? 'success' : 'info'} size="sm">
                        {mostRecent.status}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-3 text-sm text-text-secondary">
                    {mostRecent?.effectiveDateTime && (
                      <p>
                        Recorded on{' '}
                        {new Date(mostRecent.effectiveDateTime).toLocaleDateString()}
                      </p>
                    )}
                    {valueDisplay && (
                      <p className="mt-1 font-semibold text-text-primary">Result: {valueDisplay}</p>
                    )}
                  </div>
                  {test.observations.length > 1 && (
                    <details className="mt-3 border-t border-gray-100 pt-3 text-sm text-text-secondary">
                      <summary className="cursor-pointer font-medium text-primary">
                        View previous measurements ({test.observations.length - 1})
                      </summary>
                      <ul className="mt-2 space-y-2 pl-4">
                        {test.observations.slice(1).map((obs, index) => (
                          <li key={obs.id || index} className="list-disc">
                            {obs.effectiveDateTime
                              ? new Date(obs.effectiveDateTime).toLocaleDateString()
                              : 'Unknown date'}
                            {obs.valueQuantity?.value && (
                              <span className="ml-2">
                                • {obs.valueQuantity.value}{' '}
                                {obs.valueQuantity.unit || ''}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              );
            })}

            {observationTests.length > INITIAL_DISPLAY_COUNT && (
              <div className="text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllObservations((prev) => !prev)}
                >
                  {showAllObservations
                    ? 'Show fewer observations'
                    : `Show all observations (${observationTests.length - INITIAL_DISPLAY_COUNT} more)`}
                </Button>
              </div>
            )}
          </div>
        )
        : (
          <p className="text-sm text-text-secondary">
            No observations recorded.
          </p>
        )}
    </Card>
  );

  const renderDiagnosticReportsCard = () => (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary">Diagnostic Reports</h3>
        {loading.diagnosticReports && renderLoadingSpinner()}
      </div>
      {errors.diagnosticReports
        ? renderError(errors.diagnosticReports, 'diagnosticReports')
        : diagnosticList.length > 0
        ? (
          <div className="space-y-3">
            {(showAllDiagnosticReports
              ? diagnosticList
              : diagnosticList.slice(0, INITIAL_DISPLAY_COUNT)
            ).map((report) => (
              <div
                key={report.id}
                className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-text-primary">
                      {report.code?.text ||
                        report.code?.coding?.[0]?.display ||
                        'Diagnostic Report'}
                    </p>
                    {report.conclusion && (
                      <p className="mt-1 text-sm text-text-secondary">
                        Conclusion: {report.conclusion}
                      </p>
                    )}
                    {report.effectiveDateTime && (
                      <p className="mt-1 text-sm text-text-secondary">
                        Collected {new Date(report.effectiveDateTime).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {report.status && (
                    <Badge
                      variant={
                        report.status === 'final'
                          ? 'success'
                          : report.status === 'preliminary'
                          ? 'warning'
                          : 'info'
                      }
                      size="sm"
                    >
                      {report.status}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
            {diagnosticList.length > INITIAL_DISPLAY_COUNT && (
              <div className="text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllDiagnosticReports((prev) => !prev)}
                >
                  {showAllDiagnosticReports
                    ? 'Show fewer reports'
                    : `Show all reports (${diagnosticList.length - INITIAL_DISPLAY_COUNT} more)`}
                </Button>
              </div>
            )}
          </div>
        )
        : (
          <p className="text-sm text-text-secondary">
            No diagnostic reports recorded.
          </p>
        )}
    </Card>
  );

  const renderServiceRequestsCard = () => (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary">Service Requests & Lab Orders</h3>
        {loading.serviceRequests && renderLoadingSpinner()}
      </div>
      {errors.serviceRequests
        ? renderError(errors.serviceRequests, 'serviceRequests')
        : serviceRequestsList.length > 0
        ? (
          <div className="space-y-3">
            {(showAllServiceRequests
              ? serviceRequestsList
              : serviceRequestsList.slice(0, INITIAL_DISPLAY_COUNT)
            ).map((request) => (
              <div
                key={request.id}
                className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-text-primary">
                      {request.code?.text ||
                        request.code?.coding?.[0]?.display ||
                        'Service Request'}
                    </p>
                    {request.authoredOn && (
                      <p className="mt-1 text-sm text-text-secondary">
                        Ordered {new Date(request.authoredOn).toLocaleDateString()}
                      </p>
                    )}
                    {request.reasonCode?.[0]?.text && (
                      <p className="mt-1 text-sm text-text-secondary">
                        Reason: {request.reasonCode[0].text}
                      </p>
                    )}
                  </div>
                  {request.status && (
                    <Badge
                      variant={
                        request.status === 'completed'
                          ? 'success'
                          : request.status === 'active'
                          ? 'warning'
                          : request.status === 'revoked'
                          ? 'danger'
                          : 'info'
                      }
                      size="sm"
                    >
                      {request.status}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
            {serviceRequestsList.length > INITIAL_DISPLAY_COUNT && (
              <div className="text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllServiceRequests((prev) => !prev)}
                >
                  {showAllServiceRequests
                    ? 'Show fewer orders'
                    : `Show all orders (${serviceRequestsList.length - INITIAL_DISPLAY_COUNT} more)`}
                </Button>
              </div>
            )}
          </div>
        )
        : (
          <p className="text-sm text-text-secondary">
            No service requests or lab orders recorded.
          </p>
        )}
    </Card>
  );

  if (!patient) {
    return (
      <Layout>
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-text-secondary">Loading patient profile...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 pb-12">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <PatientHero
            patient={patient}
            phone={phone}
            email={email}
            address={address}
            bloodType={bloodType}
          />

          <CriticalAlerts allergies={allergies} observations={observations} />

          <HealthSnapshot
            activeConditions={snapshotMetrics.activeConditionsCount}
            criticalAllergies={snapshotMetrics.criticalAllergiesCount}
            lastVisit={snapshotMetrics.lastVisitDate}
            careTeamSize={snapshotMetrics.careTeamSize}
            loading={loading.conditions || loading.encounters}
            onConditionsClick={() => scrollToSection('treatments')}
            onAllergiesClick={() => scrollToSection('treatments')}
            onLastVisitClick={() => scrollToSection('timeline')}
            onCareTeamClick={() => scrollToSection('timeline')}
          />

          <HealthOverview
            conditions={conditions}
            medications={medications}
            allergies={allergies}
            procedures={procedures}
            loading={{
              conditions: loading.conditions,
              medications: loading.medications,
              allergies: loading.allergies,
              procedures: loading.procedures,
            }}
          />

          <StickyProfileNav
            sections={sections}
            onSectionClick={(sectionId) => scrollToSection(sectionId as SectionId)}
          />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
            <div className="space-y-10">
              <section id="overview" className="scroll-mt-32 space-y-6">
                <h2 className="text-2xl font-semibold text-text-primary">Overview</h2>
                {renderContactCard()}
                {observations.length > 0 && (
                  <Card className="border border-gray-200 bg-white shadow-sm">
                    <h3 className="mb-4 text-lg font-semibold text-text-primary">Vitals</h3>
                    <VitalsDashboard observations={observations} loading={loading.observations} />
                  </Card>
                )}
              </section>

              <section id="timeline" className="scroll-mt-32 space-y-6">
                <h2 className="text-2xl font-semibold text-text-primary">Timeline</h2>
                <Card className="border border-gray-200 bg-white shadow-sm">
                  <ClinicalTimeline
                    events={timelineEvents}
                    loading={loading.encounters || loading.procedures}
                  />
                </Card>
                <EncountersOverview
                  encounters={encounters}
                  practitioners={encounterPractitioners}
                  conditions={encounterConditions}
                  accounts={encounterAccounts}
                  procedures={procedures}
                  loading={loading.encounters}
                />
              </section>

              <section id="treatments" className="scroll-mt-32 space-y-6">
                <h2 className="text-2xl font-semibold text-text-primary">Treatments</h2>
                {renderAllergiesCard()}
                {renderConditionsCard()}
                {renderMedicationsCard()}
              </section>

              <section id="labs" className="scroll-mt-32 space-y-6">
                <h2 className="text-2xl font-semibold text-text-primary">Labs & Orders</h2>
                {renderObservationsCard()}
                {renderDiagnosticReportsCard()}
                {renderServiceRequestsCard()}
              </section>

              <section id="documents" className="scroll-mt-32 space-y-6">
                <h2 className="text-2xl font-semibold text-text-primary">History & Notes</h2>
                {renderFamilyHistoryCard()}
              </section>
            </div>

            <aside id="insurance" className="scroll-mt-32 space-y-6">
              <h2 className="text-2xl font-semibold text-text-primary">Insurance</h2>
              <InsuranceOverview
                coverage={coverage}
                explanationOfBenefit={explanationOfBenefit}
                accounts={accounts}
                organizations={accountOrganizations}
                loading={loading.coverage || loading.explanationOfBenefit}
              />
            </aside>
          </div>
        </div>
      </div>
    </Layout>
  );
}
