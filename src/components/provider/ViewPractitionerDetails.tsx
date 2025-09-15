'use client';

import React from 'react';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import type { Practitioner } from '@/types/fhir';

interface ViewPractitionerDetailsProps {
  practitioner: Practitioner | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: () => void;
}

export function ViewPractitionerDetails({ practitioner, isOpen, onClose, onEdit }: ViewPractitionerDetailsProps) {
  if (!isOpen || !practitioner) return null;

  const name = practitioner.name?.[0];
  const displayName = name?.text || 
    `${name?.prefix?.join(' ') || ''} ${name?.given?.join(' ') || ''} ${name?.family || ''}`.trim() ||
    'Unknown Practitioner';

  // Extract qualifications - show all degrees/certifications
  const qualifications = practitioner.qualification?.map(q => 
    q.code?.text || q.code?.coding?.[0]?.display
  ).filter(Boolean) || [];

  // Extract primary address with Australian format
  const address = practitioner.address?.[0];
  const addressString = address ? [
    address.line?.join(', '),
    address.city,
    address.state,
    address.postalCode
  ].filter(Boolean).join(', ') : null;

  // Extract contact info
  const phone = practitioner.telecom?.find(t => t.system === 'phone')?.value;
  const email = practitioner.telecom?.find(t => t.system === 'email')?.value;
  const fax = practitioner.telecom?.find(t => t.system === 'fax')?.value;

  // Extract identifiers for display (NPI, Provider Number, etc.)
  const npi = practitioner.identifier?.find(id => 
    id.type?.coding?.[0]?.code === 'NPI'
  )?.value;

  const providerNumber = practitioner.identifier?.find(id => 
    id.type?.coding?.[0]?.code === 'PRN'
  )?.value;

  // Check if this is an app-created practitioner (has our custom identifier system)
  const isAppCreated = practitioner.identifier?.some(id => 
    id.system === process.env.NEXT_PUBLIC_PRACTITIONER_IDENTIFIER_SYSTEM || 
    id.system?.includes('healermy.com')
  );

  // Get meta information
  const lastUpdated = practitioner.meta?.lastUpdated;
  const versionId = practitioner.meta?.versionId;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-text-primary">Practitioner Details</h2>
              <p className="text-sm text-text-secondary mt-1">ID: {practitioner.id}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Header Information */}
          <Card>
            <div className="flex items-start space-x-4">
              <div className="w-20 h-20 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              
              <div className="flex-1">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-2xl font-bold text-text-primary">{displayName}</h3>
                    {qualifications.length > 0 && (
                      <p className="text-lg text-primary font-medium">{qualifications.join(', ')}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {practitioner.active ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="danger">Inactive</Badge>
                    )}
                    {isAppCreated && (
                      <Badge variant="info">App Created</Badge>
                    )}
                  </div>
                </div>
                
                {practitioner.gender && (
                  <p className="text-text-secondary capitalize">
                    <strong>Gender:</strong> {practitioner.gender}
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* Personal Information */}
          <Card>
            <h3 className="text-lg font-semibold text-text-primary mb-4">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-text-secondary mb-2">Full Name</h4>
                <div className="space-y-1">
                  {name?.prefix && (
                    <p className="text-sm text-text-secondary">
                      <strong>Prefix:</strong> {name.prefix.join(', ')}
                    </p>
                  )}
                  {name?.given && (
                    <p className="text-sm text-text-secondary">
                      <strong>Given Name(s):</strong> {name.given.join(' ')}
                    </p>
                  )}
                  {name?.family && (
                    <p className="text-sm text-text-secondary">
                      <strong>Family Name:</strong> {name.family}
                    </p>
                  )}
                  {name?.suffix && (
                    <p className="text-sm text-text-secondary">
                      <strong>Suffix:</strong> {name.suffix.join(', ')}
                    </p>
                  )}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-text-secondary mb-2">Demographics</h4>
                <div className="space-y-1">
                  <p className="text-sm text-text-secondary capitalize">
                    <strong>Gender:</strong> {practitioner.gender || 'Not specified'}
                  </p>
                  <p className="text-sm text-text-secondary">
                    <strong>Status:</strong> {practitioner.active ? 'Active' : 'Inactive'}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Contact Information */}
          <Card>
            <h3 className="text-lg font-semibold text-text-primary mb-4">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-text-secondary mb-2">Communication</h4>
                <div className="space-y-2">
                  {phone && (
                    <div className="flex items-center">
                      <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span className="text-sm">{phone}</span>
                    </div>
                  )}
                  {email && (
                    <div className="flex items-center">
                      <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm">{email}</span>
                    </div>
                  )}
                  {fax && (
                    <div className="flex items-center">
                      <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-5 8V9m0 0l-2 2m2-2l2 2" />
                      </svg>
                      <span className="text-sm">{fax}</span>
                    </div>
                  )}
                </div>
              </div>

              {address && (
                <div>
                  <h4 className="font-medium text-text-secondary mb-2">Address</h4>
                  <div className="flex items-start">
                    <svg className="w-4 h-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <div className="text-sm">
                      {address.line && address.line.map((line, index) => (
                        <p key={index}>{line}</p>
                      ))}
                      <p>{address.city}, {address.state} {address.postalCode}</p>
                      {address.country && <p>{address.country}</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Professional Information */}
          <Card>
            <h3 className="text-lg font-semibold text-text-primary mb-4">Professional Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-text-secondary mb-2">Identifiers</h4>
                <div className="space-y-2">
                  {npi && (
                    <p className="text-sm">
                      <strong>NPI:</strong> {npi}
                    </p>
                  )}
                  {providerNumber && (
                    <p className="text-sm">
                      <strong>Provider Number:</strong> {providerNumber}
                    </p>
                  )}
                  {practitioner.identifier?.map((identifier, index) => (
                    <p key={index} className="text-xs text-text-secondary">
                      <strong>System:</strong> {identifier.system}<br />
                      <strong>Value:</strong> {identifier.value}
                    </p>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-text-secondary mb-2">Qualifications</h4>
                <div className="space-y-2">
                  {practitioner.qualification?.map((qual, index) => (
                    <div key={index} className="text-sm">
                      <p><strong>Code:</strong> {qual.code?.text || qual.code?.coding?.[0]?.display}</p>
                      {qual.period?.start && (
                        <p className="text-xs text-text-secondary">
                          <strong>Start Date:</strong> {new Date(qual.period.start).toLocaleDateString()}
                        </p>
                      )}
                      {qual.period?.end && (
                        <p className="text-xs text-text-secondary">
                          <strong>End Date:</strong> {new Date(qual.period.end).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )) || <p className="text-sm text-text-secondary">No qualifications recorded</p>}
                </div>
              </div>
            </div>
          </Card>

          {/* System Information */}
          <Card>
            <h3 className="text-lg font-semibold text-text-primary mb-4">System Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-text-secondary mb-2">Resource Metadata</h4>
                <div className="space-y-1 text-sm">
                  <p><strong>Resource Type:</strong> {practitioner.resourceType}</p>
                  <p><strong>Resource ID:</strong> {practitioner.id}</p>
                  {versionId && <p><strong>Version ID:</strong> {versionId}</p>}
                  {lastUpdated && (
                    <p>
                      <strong>Last Updated:</strong> {new Date(lastUpdated).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-text-secondary mb-2">Source Information</h4>
                <div className="space-y-1 text-sm">
                  <p><strong>Created by:</strong> {isAppCreated ? 'HealerMy Application' : 'External System'}</p>
                  <p><strong>Editable:</strong> {isAppCreated ? 'Yes' : 'No'}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Raw FHIR Data (Collapsible) */}
          <Card>
            <details className="group">
              <summary className="cursor-pointer font-medium text-text-secondary mb-2 group-open:mb-4">
                <span className="group-open:hidden">▶ Show Raw FHIR Data</span>
                <span className="hidden group-open:inline">▼ Hide Raw FHIR Data</span>
              </summary>
              <pre className="bg-gray-50 p-4 rounded-lg text-xs overflow-auto max-h-64">
                {JSON.stringify(practitioner, null, 2)}
              </pre>
            </details>
          </Card>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {isAppCreated && onEdit && (
              <Button variant="primary" onClick={onEdit}>
                Edit Practitioner
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}