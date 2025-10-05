'use client';

import React, { useState } from 'react';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';

interface Encounter {
  id: string;
  status: string;
  meta?: {
    lastUpdated?: string;
  };
  participant?: Array<{
    individual?: {
      reference?: string;
      display?: string;
    };
  }>;
  reasonReference?: Array<{
    reference?: string;
    display?: string;
  }>;
  diagnosis?: Array<{
    condition?: {
      reference?: string;
      display?: string;
    };
  }>;
  account?: Array<{
    reference?: string;
    display?: string;
  }>;
}

interface Procedure {
  id: string;
  status: string;
  encounter?: {
    reference?: string;
    display?: string;
  };
  code?: {
    text?: string;
    coding?: Array<{
      display?: string;
      code?: string;
    }>;
  };
  performedDateTime?: string;
  performer?: Array<{
    actor?: {
      reference?: string;
      display?: string;
    };
  }>;
  reasonReference?: Array<{
    reference?: string;
    display?: string;
  }>;
}

interface EncountersOverviewProps {
  encounters: Encounter[];
  practitioners: Record<string, any>;
  conditions: Record<string, any>;
  accounts: Record<string, any>;
  procedures?: Procedure[];
  loading: boolean;
}

// Extract practitioner name from FHIR Practitioner resource
const extractPractitionerName = (practitioner: any): string => {
  if (!practitioner || !practitioner.name || practitioner.name.length === 0) {
    return 'Unknown provider';
  }

  const name = practitioner.name[0];

  if (name.text) {
    return name.text;
  }

  const parts = [];
  if (name.prefix && name.prefix.length > 0) {
    parts.push(name.prefix.join(' '));
  }
  if (name.given && name.given.length > 0) {
    parts.push(name.given.join(' '));
  }
  if (name.family) {
    parts.push(name.family);
  }

  return parts.length > 0 ? parts.join(' ') : 'Unknown provider';
};

export const EncountersOverview: React.FC<EncountersOverviewProps> = ({
  encounters,
  practitioners,
  conditions,
  accounts,
  procedures = [],
  loading
}) => {
  // Track which encounters have expanded procedures
  const [expandedEncounters, setExpandedEncounters] = useState<Set<string>>(new Set());

  const toggleEncounter = (encounterId: string) => {
    setExpandedEncounters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(encounterId)) {
        newSet.delete(encounterId);
      } else {
        newSet.add(encounterId);
      }
      return newSet;
    });
  };
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'finished': return 'success';
      case 'in-progress': return 'info';
      case 'planned': return 'warning';
      case 'cancelled': return 'danger';
      default: return 'info';
    }
  };

  if (loading) {
    return (
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-text-primary mb-3">Visit History</h3>
        <Card>
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3"></div>
            <span className="text-text-secondary">Loading visit history...</span>
          </div>
        </Card>
      </div>
    );
  }

  if (encounters.length === 0) {
    return (
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-text-primary mb-3">Visit History</h3>
        <Card>
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19,4H18V2H16V4H8V2H6V4H5C3.89,4 3,4.9 3,6V20A2,2 0 0,0 5,22H19A2,2 0 0,0 21,20V6A2,2 0 0,0 19,4M19,20H5V10H19V20M5,8V6H19V8H5Z"/>
            </svg>
            <h4 className="text-lg font-medium text-gray-900 mb-1">No Visit History</h4>
            <p className="text-gray-500">No encounters found for this patient.</p>
          </div>
        </Card>
      </div>
    );
  }

  // Sort encounters by service date (most recent first)
  const sortedEncounters = [...encounters].sort((a, b) => {
    // Get service date from Account's servicePeriod
    const getServiceDate = (encounter: Encounter) => {
      if (encounter.account && encounter.account.length > 0) {
        const accountId = encounter.account[0].reference?.split('/').pop();
        const account = accountId ? accounts[accountId] : null;
        if (account?.servicePeriod?.start) {
          return new Date(account.servicePeriod.start).getTime();
        }
      }
      // Fallback to meta.lastUpdated
      return encounter.meta?.lastUpdated ? new Date(encounter.meta.lastUpdated).getTime() : 0;
    };

    const dateA = getServiceDate(a);
    const dateB = getServiceDate(b);
    return dateB - dateA;
  });

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold text-text-primary mb-3">
        Visit History ({encounters.length})
      </h3>

      <div className="space-y-4">
        {sortedEncounters.map((encounter) => {
          // Extract practitioner info
          const practitionerId = encounter.participant?.[0]?.individual?.reference?.split('/').pop();
          const practitioner = practitionerId ? practitioners[practitionerId] : null;
          const practitionerName = encounter.participant?.[0]?.individual?.display ||
            (practitioner ? extractPractitionerName(practitioner) : null) ||
            (practitionerId ? `Practitioner ID: ${practitionerId}` : 'Unknown provider');

          // Get service date from associated Account's servicePeriod
          let serviceDate: Date | null = null;
          if (encounter.account && encounter.account.length > 0) {
            const accountId = encounter.account[0].reference?.split('/').pop();
            const account = accountId ? accounts[accountId] : null;
            if (account?.servicePeriod?.start) {
              serviceDate = new Date(account.servicePeriod.start);
            }
          }

          // Fallback to meta.lastUpdated if no service date
          const displayDate = serviceDate || (encounter.meta?.lastUpdated ? new Date(encounter.meta.lastUpdated) : null);

          return (
            <Card key={encounter.id}>
              {/* Encounter Header */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19,4H18V2H16V4H8V2H6V4H5C3.89,4 3,4.9 3,6V20A2,2 0 0,0 5,22H19A2,2 0 0,0 21,20V6A2,2 0 0,0 19,4M19,20H5V10H19V20M5,8V6H19V8H5Z"/>
                  </svg>
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      Visit on {displayDate
                        ? displayDate.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })
                        : 'Unknown date'}
                    </h4>
                    <p className="text-xs text-gray-500">
                      Encounter ID: {encounter.id}
                      {serviceDate && encounter.meta?.lastUpdated && (
                        <span className="ml-2 text-gray-400">
                          (Record updated: {new Date(encounter.meta.lastUpdated).toLocaleDateString()})
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <Badge variant={getStatusVariant(encounter.status)} size="sm">
                  {encounter.status}
                </Badge>
              </div>

              {/* Encounter Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Provider */}
                <div>
                  <h5 className="font-medium text-gray-800 mb-2">👨‍⚕️ Healthcare Provider</h5>
                  <p className="text-sm text-gray-600">{practitionerName}</p>
                </div>

                {/* Reasons for Visit */}
                {encounter.reasonReference && encounter.reasonReference.length > 0 && (
                  <div>
                    <h5 className="font-medium text-gray-800 mb-2">🏥 Reason for Visit</h5>
                    <div className="flex flex-wrap gap-1">
                      {encounter.reasonReference.map((ref, idx) => {
                        const conditionId = ref.reference?.split('/').pop();
                        const condition = conditionId ? conditions[conditionId] : null;
                        const conditionName = ref.display ||
                          condition?.code?.text ||
                          condition?.code?.coding?.[0]?.display ||
                          `Condition ${conditionId}`;
                        const icdCode = condition?.code?.coding?.[0]?.code;

                        return (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-1 rounded-md bg-yellow-50 text-yellow-800 text-xs"
                          >
                            {conditionName}{icdCode && ` (${icdCode})`}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Diagnosis */}
                {encounter.diagnosis && encounter.diagnosis.length > 0 && (
                  <div>
                    <h5 className="font-medium text-gray-800 mb-2">🩺 Confirmed Diagnosis</h5>
                    <div className="flex flex-wrap gap-1">
                      {encounter.diagnosis.map((diag, idx) => {
                        const conditionId = diag.condition?.reference?.split('/').pop();
                        const condition = conditionId ? conditions[conditionId] : null;
                        const conditionName = diag.condition?.display ||
                          condition?.code?.text ||
                          condition?.code?.coding?.[0]?.display ||
                          `Condition ${conditionId}`;
                        const icdCode = condition?.code?.coding?.[0]?.code;

                        return (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-1 rounded-md bg-green-50 text-green-800 text-xs"
                          >
                            {conditionName}{icdCode && ` (${icdCode})`}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Procedures Section - Collapsible */}
              {(() => {
                // Filter procedures that belong to this encounter
                const encounterProcedures = procedures.filter(proc => {
                  // Check if procedure references this encounter
                  // Note: FHIR Procedure may have encounter reference
                  return proc.encounter?.reference?.includes(encounter.id);
                });

                // If no direct encounter reference, show all procedures for single encounter
                const proceduresToShow = encounterProcedures.length > 0
                  ? encounterProcedures
                  : (encounters.length === 1 ? procedures : []);

                if (proceduresToShow.length === 0) return null;

                const isExpanded = expandedEncounters.has(encounter.id);

                return (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => toggleEncounter(encounter.id)}
                      className="w-full flex items-center justify-between text-left hover:bg-gray-50 p-2 rounded transition-colors"
                    >
                      <div className="flex items-center">
                        <span className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                          ▶
                        </span>
                        <h5 className="ml-2 font-medium text-gray-800">
                          Medical Procedures ({proceduresToShow.length})
                        </h5>
                      </div>
                      <span className="text-sm text-gray-500">
                        {isExpanded ? 'Click to collapse' : 'Click to expand'}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="mt-3 space-y-2 pl-4">
                        {proceduresToShow.map((procedure) => {
                          const procedureName = procedure.code?.text ||
                            procedure.code?.coding?.[0]?.display ||
                            'Unknown procedure';

                          const performerId = procedure.performer?.[0]?.actor?.reference?.split('/').pop();
                          const performer = performerId ? practitioners[performerId] : null;
                          const performerName = procedure.performer?.[0]?.actor?.display ||
                            (performer ? extractPractitionerName(performer) : null);

                          return (
                            <div
                              key={procedure.id}
                              className="p-3 rounded-md bg-gray-50 border border-gray-200"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h6 className="font-medium text-gray-900 text-sm">
                                    {procedureName}
                                  </h6>
                                  {performerName && (
                                    <p className="text-xs text-gray-600 mt-1">
                                      Performer: {performerName}
                                    </p>
                                  )}

                                  {/* Procedure reasons */}
                                  {procedure.reasonReference && procedure.reasonReference.length > 0 && (
                                    <div className="mt-2">
                                      <p className="text-xs text-gray-600 mb-1">Reason:</p>
                                      <div className="flex flex-wrap gap-1">
                                        {procedure.reasonReference.map((ref, idx) => {
                                          const conditionId = ref.reference?.split('/').pop();
                                          const condition = conditionId ? conditions[conditionId] : null;
                                          const conditionName = condition?.code?.text ||
                                            condition?.code?.coding?.[0]?.display ||
                                            `Condition ${conditionId}`;
                                          const icdCode = condition?.code?.coding?.[0]?.code;

                                          return (
                                            <span
                                              key={idx}
                                              className="inline-flex items-center px-2 py-0.5 rounded-md bg-yellow-50 text-yellow-800 text-xs"
                                            >
                                              {conditionName}{icdCode && ` (${icdCode})`}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <Badge
                                  variant={procedure.status === 'completed' ? 'success' : 'info'}
                                  size="sm"
                                >
                                  {procedure.status}
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </Card>
          );
        })}
      </div>
    </div>
  );
};