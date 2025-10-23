'use client';

import React from 'react';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { FancyLoader } from '@/components/common/FancyLoader';
import type { Coverage, ExplanationOfBenefit } from '@/types/fhir';

// CoverageDetails type definition (formerly from operations)
interface CoverageDetails {
  id?: string;
  status?: string;
  kind?: string;
  subscriberId?: string;
  network?: string;
  effectivePeriod?: { start?: string; end?: string };
  insurerName?: string;
  groupNumber?: string;
  planName?: string;
  memberNumber?: string;
  copay?: string;
  deductible?: string;
  coverage?: Coverage;
  organization?: any;
}

interface Account {
  id: string;
  status: string;
  type?: {
    coding?: Array<{
      code?: string;
      display?: string;
    }>;
  };
  servicePeriod?: {
    start?: string;
    end?: string;
  };
  owner?: {
    reference?: string;
    display?: string;
  };
  guarantor?: Array<{
    party?: {
      reference?: string;
      display?: string;
    };
  }>;
}

interface Organization {
  id: string;
  name?: string;
  telecom?: Array<{
    system?: string;
    value?: string;
  }>;
  address?: Array<{
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }>;
}

interface InsuranceOverviewProps {
  coverage: Coverage[];
  explanationOfBenefit?: ExplanationOfBenefit[];
  accounts?: Account[];
  organizations?: Record<string, Organization>;
  loading: boolean;
}

export const InsuranceOverview: React.FC<InsuranceOverviewProps> = ({
  coverage,
  explanationOfBenefit = [],
  accounts = [],
  organizations = {},
  loading
}) => {
  // Extract coverage details for display
  const extractCoverageDetails = (cov: Coverage): CoverageDetails => {
    const details: CoverageDetails = {
      id: cov.id,
      status: cov.status,
      kind: cov.kind || 'insurance',
      subscriberId: cov.subscriberId,
      network: cov.network,
      effectivePeriod: cov.period,
    };

    // Extract insurer name from payor
    if (cov.payor?.[0]?.display) {
      details.insurerName = cov.payor[0].display;
    }

    // Try to get payor reference for organization lookup
    if (cov.payor?.[0]?.reference) {
      details.insurerName = details.insurerName || cov.payor[0].reference;
    }

    // Extract plan information from class
    if (cov.class) {
      for (const classItem of cov.class) {
        const classType = classItem.type?.coding?.[0]?.code || (classItem.type as any)?.text;

        switch (classType?.toLowerCase()) {
          case 'group':
            details.groupNumber = classItem.value;
            break;
          case 'plan':
            details.planName = classItem.name || classItem.value;
            break;
          case 'subgroup':
            details.memberNumber = classItem.value;
            break;
        }
      }
    }

    // Extract cost information
    if (cov.costToBeneficiary) {
      for (const cost of cov.costToBeneficiary) {
        const costType = cost.type?.coding?.[0]?.code || (cost.type as any)?.text;
        const costAny = cost as any;
        const amount = cost.valueMoney ?
          `$${cost.valueMoney.value} ${cost.valueMoney.currency || 'USD'}` :
          costAny.valueQuantity ?
          `${costAny.valueQuantity.value} ${costAny.valueQuantity.unit || ''}` :
          undefined;

        switch (costType?.toLowerCase()) {
          case 'copay':
            details.copay = amount;
            break;
          case 'deductible':
            details.deductible = amount;
            break;
        }
      }
    }

    return details;
  };

  // Check if coverage is expired
  const isCoverageExpired = (cov: Coverage): boolean => {
    if (!cov.period?.end) return false;
    return new Date(cov.period.end) < new Date();
  };

  // Get coverage type display name
  const getCoverageType = (cov: Coverage): string => {
    return cov.type?.coding?.[0]?.display ||
           cov.type?.text ||
           'Insurance Coverage';
  };

  // Calculate financial summary from EOB data
  const calculateFinancialSummary = () => {
    if (!explanationOfBenefit || explanationOfBenefit.length === 0) {
      return null;
    }

    let totalBilled = 0;
    let insurancePaid = 0;
    let patientPaid = 0;
    const claimCount = explanationOfBenefit.length;

    // Get current year for filtering
    const currentYear = new Date().getFullYear();

    // Filter claims from current year
    const currentYearClaims = explanationOfBenefit.filter(eob => {
      if (!eob.created) return false;
      const claimYear = new Date(eob.created).getFullYear();
      return claimYear === currentYear;
    });

    currentYearClaims.forEach(eob => {
      // Calculate from total field
      if (eob.total) {
        eob.total.forEach(t => {
          const code = t.category?.coding?.[0]?.code?.toLowerCase();
          const amount = t.amount?.value || 0;

          if (code === 'submitted' || code === 'benefit') {
            totalBilled += amount;
          } else if (code === 'payment') {
            insurancePaid += amount;
          }
        });
      }

      // Calculate patient responsibility from payment field
      if (eob.payment?.amount?.value) {
        const paymentAmount = eob.payment.amount.value;
        // If payment type indicates patient payment
        if (eob.payment.type?.coding?.[0]?.code === 'complete') {
          insurancePaid += paymentAmount;
        }
      }

      // Calculate from items if totals not available
      if (!eob.total && eob.item) {
        eob.item.forEach(item => {
          // Add item net cost to total
          if (item.net?.value) {
            totalBilled += item.net.value;
          }

          // Check adjudication for insurance vs patient costs
          if (item.adjudication) {
            item.adjudication.forEach(adj => {
              const adjCode = adj.category?.coding?.[0]?.code?.toLowerCase();
              const adjAmount = adj.amount?.value || 0;

              if (adjCode === 'benefit' || adjCode === 'paid') {
                insurancePaid += adjAmount;
              } else if (adjCode === 'copay' || adjCode === 'deductible' || adjCode === 'patient') {
                patientPaid += adjAmount;
              }
            });
          }
        });
      }
    });

    // Calculate patient paid as difference if not explicitly provided
    if (patientPaid === 0 && totalBilled > 0 && insurancePaid > 0) {
      patientPaid = totalBilled - insurancePaid;
    }

    return {
      claimCount: currentYearClaims.length,
      totalBilled,
      insurancePaid,
      patientPaid,
      year: currentYear
    };
  };

  const financialSummary = calculateFinancialSummary();

  const activeCoverage = coverage.filter(cov => cov.status === 'active');
  const primaryCoverage = activeCoverage.sort((a, b) => {
    const orderA = a.order || 999;
    const orderB = b.order || 999;
    return orderA - orderB;
  })[0];

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'cancelled': return 'danger';
      case 'draft': return 'warning';
      case 'entered-in-error': return 'danger';
      default: return 'info';
    }
  };

  const getKindIcon = (kind?: string) => {
    switch (kind) {
      case 'insurance':
        return (
          <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10.5V11.5C14.8,12.4 14.4,13.2 13.7,13.7C13.9,13.9 14,14.2 14,14.5V16.5C14,17.3 13.3,18 12.5,18H11.5C10.7,18 10,17.3 10,16.5V14.5C10,14.2 10.1,13.9 10.3,13.7C9.6,13.2 9.2,12.4 9.2,11.5V10.5C9.2,8.6 10.6,7 12,7M12,8.2C11.2,8.2 10.4,8.7 10.4,10.5V11.5C10.4,12.3 11.1,12.8 11.5,12.8H12.5C12.9,12.8 13.6,12.3 13.6,11.5V10.5C13.6,8.7 12.8,8.2 12,8.2Z"/>
          </svg>
        );
      case 'self-pay':
        return (
          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7,15H9C9,16.08 10.37,17 12,17C13.63,17 15,16.08 15,15C15,13.9 13.96,13.5 11.76,12.97C9.64,12.44 7,11.78 7,9C7,7.21 8.47,5.69 10.5,5.18V3H13.5V5.18C15.53,5.69 17,7.21 17,9H15C15,7.92 13.63,7 12,7C10.37,7 9,7.92 9,9C9,10.1 10.04,10.5 12.24,11.03C14.36,11.56 17,12.22 17,15C17,16.79 15.53,18.31 13.5,18.82V21H10.5V18.82C8.47,18.31 7,16.79 7,15Z"/>
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,17H13V15H11V17M11,13H13V7H11V13Z"/>
          </svg>
        );
    }
  };

  if (loading) {
    return (
      <div className="mb-8">
        <h2 className="text-base sm:text-lg md:text-xl font-bold text-text-primary mb-4 border-b border-gray-200 pb-2">
          Insurance Information
        </h2>
        <Card>
          <div className="flex items-center justify-center py-8">
            <FancyLoader size="sm" className="mr-3" />
            <span className="text-text-secondary">Loading insurance information...</span>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h2 className="text-base sm:text-lg md:text-xl font-bold text-text-primary mb-4 border-b border-gray-200 pb-2">
        Insurance Information
      </h2>

      {coverage.length === 0 && accounts.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10.5V11.5C14.8,12.4 14.4,13.2 13.7,13.7C13.9,13.9 14,14.2 14,14.5V16.5C14,17.3 13.3,18 12.5,18H11.5C10.7,18 10,17.3 10,16.5V14.5C10,14.2 10.1,13.9 10.3,13.7C9.6,13.2 9.2,12.4 9.2,11.5V10.5C9.2,8.6 10.6,7 12,7M12,8.2C11.2,8.2 10.4,8.7 10.4,10.5V11.5C10.4,12.3 11.1,12.8 11.5,12.8H12.5C12.9,12.8 13.6,12.3 13.6,11.5V10.5C13.6,8.7 12.8,8.2 12,8.2Z"/>
            </svg>
            <h3 className="text-sm sm:text-base md:text-lg font-medium text-gray-900 mb-1">No Insurance Information</h3>
            <p className="text-gray-500">No insurance coverage or billing accounts found for this patient.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Financial Summary from EOB */}
          {financialSummary && (
            <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 flex items-center">
                    <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6,16.5L3,19.44V11H6M11,14.66L9.43,13.32L8,14.64V7H11M16,13L13,16V3H16M18.81,12.81L17,11H22V16L20.21,14.21L13,21.36L9.53,18.34L5.75,22H3L9.47,15.66L13,18.64"/>
                    </svg>
                    {financialSummary.year} Financial Summary
                  </h3>
                  <Badge variant="success" size="sm">
                    {financialSummary.claimCount} {financialSummary.claimCount === 1 ? 'Claim' : 'Claims'}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Total Billed */}
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="text-sm font-medium text-gray-600 mb-1">Total Billed</div>
                  <div className="text-xl sm:text-2xl font-bold text-gray-900">
                    ${financialSummary.totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    All medical services
                  </div>
                </div>

                {/* Insurance Paid */}
                <div className="bg-white rounded-lg p-4 border border-green-200">
                  <div className="text-sm font-medium text-green-700 mb-1">Insurance Paid</div>
                  <div className="text-xl sm:text-2xl font-bold text-green-600">
                    ${financialSummary.insurancePaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    {financialSummary.totalBilled > 0 ?
                      `${Math.round((financialSummary.insurancePaid / financialSummary.totalBilled) * 100)}% covered` :
                      '0% covered'
                    }
                  </div>
                </div>

                {/* You Paid */}
                <div className="bg-white rounded-lg p-4 border border-orange-200">
                  <div className="text-sm font-medium text-orange-700 mb-1">You Paid</div>
                  <div className="text-xl sm:text-2xl font-bold text-orange-600">
                    ${financialSummary.patientPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs text-orange-600 mt-1">
                    {financialSummary.totalBilled > 0 ?
                      `${Math.round((financialSummary.patientPaid / financialSummary.totalBilled) * 100)}% responsibility` :
                      '0% responsibility'
                    }
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Primary Coverage Summary */}
          {primaryCoverage && (
            <Card className="border-blue-200 bg-blue-50">
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {getKindIcon(primaryCoverage.kind)}
                    <h3 className="ml-2 text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                      Primary Insurance
                    </h3>
                  </div>
                  <Badge variant={getStatusVariant(primaryCoverage.status)} size="sm">
                    {primaryCoverage.status}
                  </Badge>
                </div>
              </div>

              {(() => {
                const details = extractCoverageDetails(primaryCoverage);
                const isExpired = isCoverageExpired(primaryCoverage);
                const coverageType = getCoverageType(primaryCoverage);
                const planNumber = primaryCoverage.identifier?.[0]?.value;

                return (
                  <>
                    {/* Expiration Warning */}
                    {isExpired && (
                      <div className="mb-4 p-3 bg-orange-100 border border-orange-300 rounded-lg">
                        <div className="flex items-center text-orange-800">
                          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12,2L1,21H23M12,6L19.53,19H4.47M11,10V14H13V10M11,16V18H13V16" />
                          </svg>
                          <span className="font-medium">This coverage expired on {new Date(primaryCoverage.period?.end!).toLocaleDateString()}</span>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Insurance Type */}
                      <div>
                        <h4 className="font-medium text-gray-800 mb-2">Insurance Type</h4>
                        <p className="text-sm text-gray-600">
                          {coverageType}
                        </p>
                      </div>

                      {/* Insurance Company */}
                      <div>
                        <h4 className="font-medium text-gray-800 mb-2">Insurance Company</h4>
                        <p className="text-sm text-gray-600">
                          {details.insurerName || 'Not specified'}
                        </p>
                      </div>

                      {/* Plan Number */}
                      {planNumber && (
                        <div>
                          <h4 className="font-medium text-gray-800 mb-2">Plan Number</h4>
                          <p className="text-sm text-gray-600 font-mono">
                            {planNumber}
                          </p>
                        </div>
                      )}

                      {/* Policy Holder */}
                      {primaryCoverage.policyHolder?.display && (
                        <div>
                          <h4 className="font-medium text-gray-800 mb-2">Policy Holder</h4>
                          <p className="text-sm text-gray-600">
                            {primaryCoverage.policyHolder.display}
                          </p>
                        </div>
                      )}

                      {/* Subscriber */}
                      {primaryCoverage.subscriber?.display && (
                        <div>
                          <h4 className="font-medium text-gray-800 mb-2">Subscriber</h4>
                          <p className="text-sm text-gray-600">
                            {primaryCoverage.subscriber.display}
                          </p>
                        </div>
                      )}

                      {/* Relationship */}
                      {primaryCoverage.relationship?.coding?.[0]?.display && (
                        <div>
                          <h4 className="font-medium text-gray-800 mb-2">Relationship</h4>
                          <p className="text-sm text-gray-600">
                            {primaryCoverage.relationship.coding[0].display}
                          </p>
                        </div>
                      )}

                      {/* Coverage Period */}
                      {details.effectivePeriod && (
                        <div className="md:col-span-2 lg:col-span-3">
                          <h4 className="font-medium text-gray-800 mb-2">Coverage Period</h4>
                          <p className="text-sm text-gray-600">
                            {details.effectivePeriod.start ?
                              new Date(details.effectivePeriod.start).toLocaleDateString() :
                              'Not specified'
                            }
                            {details.effectivePeriod.end ?
                              ` - ${new Date(details.effectivePeriod.end).toLocaleDateString()}` :
                              ' - Ongoing'
                            }
                            {isExpired && (
                              <span className="ml-2 text-orange-600 font-medium">(Expired)</span>
                            )}
                          </p>
                        </div>
                      )}

                      {/* Member ID */}
                      {details.subscriberId && (
                        <div>
                          <h4 className="font-medium text-gray-800 mb-2">Member ID</h4>
                          <p className="text-sm text-gray-600 font-mono">
                            {details.subscriberId}
                          </p>
                        </div>
                      )}

                      {details.groupNumber && (
                        <div>
                          <h4 className="font-medium text-gray-800 mb-2">Group Number</h4>
                          <p className="text-sm text-gray-600 font-mono">
                            {details.groupNumber}
                          </p>
                        </div>
                      )}

                      {details.network && (
                        <div>
                          <h4 className="font-medium text-gray-800 mb-2">Network</h4>
                          <p className="text-sm text-gray-600">
                            {details.network}
                          </p>
                        </div>
                      )}

                      {details.planName && (
                        <div>
                          <h4 className="font-medium text-gray-800 mb-2">Plan Name</h4>
                          <p className="text-sm text-gray-600">
                            {details.planName}
                          </p>
                        </div>
                      )}

                      {(details.copay || details.deductible) && (
                        <div className="md:col-span-2 lg:col-span-3">
                          <h4 className="font-medium text-gray-800 mb-2">Cost Information</h4>
                          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                            {details.copay && (
                              <span>Copay: {details.copay}</span>
                            )}
                            {details.deductible && (
                              <span>Deductible: {details.deductible}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </Card>
          )}

          {/* Recent Claims */}
          {explanationOfBenefit && explanationOfBenefit.length > 0 && (
            <Card>
              <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-4 flex items-center justify-between">
                <span>Recent Claims</span>
                {explanationOfBenefit.length > 5 && (
                  <span className="text-sm font-normal text-gray-500">
                    Showing latest 5 of {explanationOfBenefit.length}
                  </span>
                )}
              </h3>
              <div className="space-y-3">
                {explanationOfBenefit
                  .sort((a, b) => {
                    const dateA = a.created ? new Date(a.created).getTime() : 0;
                    const dateB = b.created ? new Date(b.created).getTime() : 0;
                    return dateB - dateA;
                  })
                  .slice(0, 5)
                  .map((eob, index) => {
                    // Get claim amount
                    const totalAmount = eob.total?.find(t =>
                      t.category?.coding?.[0]?.code?.toLowerCase() === 'submitted' ||
                      t.category?.coding?.[0]?.code?.toLowerCase() === 'benefit'
                    )?.amount?.value || 0;

                    const insurancePaid = eob.total?.find(t =>
                      t.category?.coding?.[0]?.code?.toLowerCase() === 'payment'
                    )?.amount?.value || eob.payment?.amount?.value || 0;

                    const patientPaid = totalAmount - insurancePaid;

                    // Get service description
                    const serviceDescription = eob.type?.coding?.[0]?.display ||
                                              eob.type?.text ||
                                              eob.item?.[0]?.productOrService?.text ||
                                              'Medical Service';

                    const outcomeVariant = eob.outcome === 'complete' ? 'success' :
                                          eob.outcome === 'error' ? 'danger' :
                                          eob.outcome === 'partial' ? 'warning' : 'info';

                    return (
                      <div
                        key={eob.id}
                        className="p-4 rounded-lg border border-gray-200 bg-gray-50 hover:bg-white transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-gray-900">{serviceDescription}</h4>
                              {eob.outcome && (
                                <Badge variant={outcomeVariant} size="sm">
                                  {eob.outcome}
                                </Badge>
                              )}
                            </div>
                            {eob.created && (
                              <p className="text-sm text-gray-600 mt-1">
                                {new Date(eob.created).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </p>
                            )}
                            {eob.provider?.display && (
                              <p className="text-sm text-gray-500 mt-1">
                                Provider: {eob.provider.display}
                              </p>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            {totalAmount > 0 && (
                              <>
                                <div className="text-sm sm:text-base md:text-lg font-bold text-gray-900">
                                  ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                                <div className="text-xs text-green-600">
                                  Insurance: ${insurancePaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                                {patientPaid > 0 && (
                                  <div className="text-xs text-orange-600">
                                    You paid: ${patientPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </Card>
          )}

          {/* All Coverage List */}
          {coverage.length > 1 && (
            <Card>
              <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-4">
                All Coverage ({coverage.length})
              </h3>
              <div className="space-y-3">
                {coverage.map((cov, index) => {
                  const details = extractCoverageDetails(cov);
                  const isPrimary = cov.id === primaryCoverage?.id;
                  const isExpired = isCoverageExpired(cov);
                  const coverageType = getCoverageType(cov);
                  const planNumber = cov.identifier?.[0]?.value;

                  return (
                    <div
                      key={cov.id}
                      className={`p-4 rounded-lg border ${
                        isPrimary ? 'border-blue-200 bg-blue-50' :
                        isExpired ? 'border-gray-300 bg-gray-100' :
                        'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          {getKindIcon(cov.kind)}
                          <span className="ml-2 font-medium text-gray-900">
                            {coverageType}
                            {isPrimary && (
                              <Badge variant="info" size="sm" className="ml-2">Primary</Badge>
                            )}
                            {isExpired && (
                              <Badge variant="warning" size="sm" className="ml-2">Expired</Badge>
                            )}
                          </span>
                        </div>
                        <Badge variant={getStatusVariant(cov.status)} size="sm">
                          {cov.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                        {cov.policyHolder?.display && (
                          <div>
                            <span className="font-medium">Policy Holder:</span> {cov.policyHolder.display}
                          </div>
                        )}
                        {cov.subscriber?.display && (
                          <div>
                            <span className="font-medium">Subscriber:</span> {cov.subscriber.display}
                          </div>
                        )}
                        {planNumber && (
                          <div>
                            <span className="font-medium">Plan #:</span> <span className="font-mono">{planNumber}</span>
                          </div>
                        )}
                        {cov.relationship?.coding?.[0]?.display && (
                          <div>
                            <span className="font-medium">Relationship:</span> {cov.relationship.coding[0].display}
                          </div>
                        )}
                        {cov.period && (
                          <div className="md:col-span-2">
                            <span className="font-medium">Period:</span>{' '}
                            {cov.period.start ? new Date(cov.period.start).toLocaleDateString() : 'N/A'}
                            {' - '}
                            {cov.period.end ? new Date(cov.period.end).toLocaleDateString() : 'Ongoing'}
                            {isExpired && <span className="ml-1 text-orange-600">(Expired)</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Billing Accounts Section */}
          {accounts.length > 0 && (
            <Card className="mt-4">
              <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-4">
                Billing Accounts ({accounts.length})
              </h3>
              <div className="space-y-4">
                {accounts.map((account) => {
                  const ownerId = account.owner?.reference?.split('/').pop();
                  const organization = ownerId ? organizations[ownerId] : null;

                  return (
                    <div
                      key={account.id}
                      className="p-4 rounded-lg border border-gray-200 bg-gray-50"
                    >
                      {/* Account Status and Type */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <svg className="w-5 h-5 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8M12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12A2,2 0 0,0 12,10M10,22C9.75,22 9.54,21.82 9.5,21.58L9.13,18.93C8.5,18.68 7.96,18.34 7.44,17.94L4.95,18.95C4.73,19.03 4.46,18.95 4.34,18.73L2.34,15.27C2.21,15.05 2.27,14.78 2.46,14.63L4.57,12.97L4.5,12L4.57,11L2.46,9.37C2.27,9.22 2.21,8.95 2.34,8.73L4.34,5.27C4.46,5.05 4.73,4.96 4.95,5.05L7.44,6.05C7.96,5.66 8.5,5.32 9.13,5.07L9.5,2.42C9.54,2.18 9.75,2 10,2H14C14.25,2 14.46,2.18 14.5,2.42L14.87,5.07C15.5,5.32 16.04,5.66 16.56,6.05L19.05,5.05C19.27,4.96 19.54,5.05 19.66,5.27L21.66,8.73C21.79,8.95 21.73,9.22 21.54,9.37L19.43,11L19.5,12L19.43,13L21.54,14.63C21.73,14.78 21.79,15.05 21.66,15.27L19.66,18.73C19.54,18.95 19.27,19.04 19.05,18.95L16.56,17.95C16.04,18.34 15.5,18.68 14.87,18.93L14.5,21.58C14.46,21.82 14.25,22 14,22H10M11.25,4L10.88,6.61C9.68,6.86 8.62,7.5 7.85,8.39L5.44,7.35L4.69,8.65L6.8,10.2C6.4,11.37 6.4,12.64 6.8,13.8L4.68,15.36L5.43,16.66L7.86,15.62C8.63,16.5 9.68,17.14 10.87,17.38L11.24,20H12.76L13.13,17.39C14.32,17.14 15.37,16.5 16.14,15.62L18.57,16.66L19.32,15.36L17.2,13.81C17.6,12.64 17.6,11.37 17.2,10.2L19.31,8.65L18.56,7.35L16.15,8.39C15.38,7.5 14.32,6.86 13.12,6.62L12.75,4H11.25Z"/>
                          </svg>
                          <span className="font-medium text-gray-900">
                            {account.type?.coding?.[0]?.display || 'Account'}
                          </span>
                        </div>
                        <Badge
                          variant={account.status === 'active' ? 'success' : 'info'}
                          size="sm"
                        >
                          {account.status}
                        </Badge>
                      </div>

                      {/* Account Details Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Service Period */}
                        {account.servicePeriod && (
                          <div>
                            <h4 className="font-medium text-gray-800 mb-2">Service Period</h4>
                            <p className="text-sm text-gray-600">
                              {account.servicePeriod.start ?
                                new Date(account.servicePeriod.start).toLocaleDateString() :
                                'Not specified'
                              }
                              {account.servicePeriod.end ?
                                ` - ${new Date(account.servicePeriod.end).toLocaleDateString()}` :
                                ' - Ongoing'
                              }
                            </p>
                          </div>
                        )}

                        {/* Managing Organization */}
                        {organization && (
                          <div>
                            <h4 className="font-medium text-gray-800 mb-2">Managed By</h4>
                            <p className="text-sm text-gray-900 font-medium">
                              {organization.name || 'Unknown organization'}
                            </p>
                            {organization.telecom?.find(t => t.system === 'phone')?.value && (
                              <p className="text-sm text-gray-600 mt-1">
                                📞 {organization.telecom.find(t => t.system === 'phone')?.value}
                              </p>
                            )}
                            {organization.address?.[0] && (() => {
                              const addr = organization.address[0];
                              const parts = [];
                              if (addr.line?.[0]) parts.push(addr.line[0]);
                              if (addr.city) parts.push(addr.city);
                              if (addr.state) parts.push(addr.state);
                              if (addr.postalCode) parts.push(addr.postalCode);
                              if (parts.length > 0) {
                                return (
                                  <p className="text-sm text-gray-600 mt-1">
                                    📍 {parts.join(', ')}
                                  </p>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        )}

                        {/* Guarantor */}
                        {account.guarantor?.[0] && (
                          <div>
                            <h4 className="font-medium text-gray-800 mb-2">Guarantor</h4>
                            <p className="text-sm text-gray-600">
                              {account.guarantor[0].party?.display || 'Patient'}
                            </p>
                          </div>
                        )}

                        {/* Account ID */}
                        <div>
                          <h4 className="font-medium text-gray-800 mb-2">Account ID</h4>
                          <p className="text-sm text-gray-600 font-mono">
                            {account.id}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};