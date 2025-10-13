'use client';

import React, { useState } from 'react';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import type { Coverage, ExplanationOfBenefit } from '@/types/fhir';

interface InsuranceSidebarProps {
  coverage: Coverage[];
  explanationOfBenefit: ExplanationOfBenefit[];
  loading?: boolean;
}

export const InsuranceSidebar: React.FC<InsuranceSidebarProps> = ({
  coverage,
  explanationOfBenefit,
  loading = false,
}) => {
  const [showAllClaims, setShowAllClaims] = useState(false);

  if (loading) {
    return (
      <Card className="animate-pulse">
        <div className="h-48 bg-gray-100" />
      </Card>
    );
  }

  const activeCoverage = coverage.find(c => c.status === 'active') || coverage[0];
  const displayedClaims = showAllClaims ? explanationOfBenefit : explanationOfBenefit.slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Coverage Summary */}
      <Card>
        <div className="p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
              <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
            </svg>
            Insurance Coverage
          </h3>

          {activeCoverage ? (
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Plan</p>
                <p className="font-medium text-gray-900">
                  {activeCoverage.type?.text || activeCoverage.type?.coding?.[0]?.display || 'Health Insurance'}
                </p>
              </div>

              {activeCoverage.payor && activeCoverage.payor.length > 0 && (
                <div>
                  <p className="text-sm text-gray-600">Insurer</p>
                  <p className="font-medium text-gray-900">
                    {activeCoverage.payor[0].display || 'Unknown Payor'}
                  </p>
                </div>
              )}

              {activeCoverage.subscriberId && (
                <div>
                  <p className="text-sm text-gray-600">Member ID</p>
                  <p className="font-mono text-sm text-gray-900">
                    {activeCoverage.subscriberId}
                  </p>
                </div>
              )}

              {activeCoverage.period && (
                <div>
                  <p className="text-sm text-gray-600">Coverage Period</p>
                  <p className="text-sm text-gray-900">
                    {activeCoverage.period.start ? new Date(activeCoverage.period.start).toLocaleDateString() : 'N/A'}
                    {' - '}
                    {activeCoverage.period.end ? new Date(activeCoverage.period.end).toLocaleDateString() : 'Active'}
                  </p>
                </div>
              )}

              <Badge variant="success" size="sm" className="w-full justify-center">
                Active Coverage
              </Badge>
            </div>
          ) : (
            <p className="text-sm text-gray-600">No active coverage on file</p>
          )}
        </div>
      </Card>

      {/* Recent Claims */}
      {explanationOfBenefit.length > 0 && (
        <Card>
          <div className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
              Recent Claims
            </h3>

            <div className="space-y-3">
              {displayedClaims.map((eob, index) => {
                const totalCost = eob.total?.find(t => t.category?.coding?.[0]?.code === 'submitted')?.amount?.value;
                const date = eob.created ? new Date(eob.created).toLocaleDateString() : 'Unknown';

                return (
                  <div key={eob.id || index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-medium text-gray-900">
                        Claim #{eob.id?.slice(-8) || 'N/A'}
                      </p>
                      <Badge
                        variant={eob.status === 'active' ? 'success' : 'info'}
                        size="sm"
                      >
                        {eob.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600 mb-1">{date}</p>
                    {totalCost && (
                      <p className="text-sm font-semibold text-gray-900">
                        ${totalCost.toFixed(2)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {explanationOfBenefit.length > 3 && (
              <button
                onClick={() => setShowAllClaims(!showAllClaims)}
                className="mt-3 w-full text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {showAllClaims ? 'Show Less' : `Show ${explanationOfBenefit.length - 3} More`}
              </button>
            )}
          </div>
        </Card>
      )}

      {/* Documents Card Placeholder */}
      <Card>
        <div className="p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
            </svg>
            Documents
          </h3>
          <p className="text-sm text-gray-600">
            No documents available
          </p>
        </div>
      </Card>
    </div>
  );
};
