'use client';

import React from 'react';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import type { Practitioner } from '@/types/fhir';

interface ViewPractitionerDetailsProps {
  practitioner: Practitioner | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: () => void;
}

export function ViewPractitionerDetails({ practitioner, isOpen, onClose, onEdit }: ViewPractitionerDetailsProps) {
  if (!practitioner) return null;

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

  // Get meta information
  const lastUpdated = practitioner.meta?.lastUpdated;
  const versionId = practitioner.meta?.versionId;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Practitioner Details</DialogTitle>
          <DialogDescription>
            ID: {practitioner.id}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Information */}
          <div className="flex items-start space-x-4">
            <div className="w-20 h-20 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>

            <div className="flex-1">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-xl sm:text-xl font-bold text-text-primary">{displayName}</h3>
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
                </div>
              </div>

              {practitioner.gender && (
                <p className="text-text-secondary capitalize">
                  <strong>Gender:</strong> {practitioner.gender}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Personal Information */}
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-text-primary mb-4">Personal Information</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              {/* Row 1: Given Name and Family Name */}
              {name?.given && (
                <p className="text-sm">
                  <strong className="text-text-secondary">Given Name(s):</strong> {name.given.join(' ')}
                </p>
              )}
              {name?.family && (
                <p className="text-sm">
                  <strong className="text-text-secondary">Family Name:</strong> {name.family}
                </p>
              )}

              {/* Row 2: Gender and Status (only if exists) */}
              <p className="text-sm capitalize">
                <strong className="text-text-secondary">Gender:</strong> {practitioner.gender || 'Not Specified'}
              </p>
              <p className="text-sm">
                <strong className="text-text-secondary">Status:</strong> {practitioner.active ? 'Active' : 'Inactive'}
              </p>
            </div>
          </div>

          <Separator />

          {/* Contact Information */}
          <div>
            <h3 className="text-sm sm:text-base md:text-lg font-semibold text-text-primary mb-4">Contact Information</h3>
            <div className="space-y-2">
              {/* Phone */}
              {phone && (
                <p className="text-sm">
                  <strong className="text-text-secondary">Phone</strong>
                  <br />
                  <svg className="w-4 h-4 text-gray-400 mr-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {phone}
                </p>
              )}

              {/* Address */}
              {address && (
                <p className="text-sm">
                  <strong className="text-text-secondary">Address</strong>
                  <br />
                  <svg className="w-4 h-4 text-gray-400 mr-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {address.line && address.line.join(', ')}
                  {address.line && address.line.length > 0 && (address.city || address.state || address.postalCode) && ', '}
                  {[address.city, address.state, address.postalCode].filter(Boolean).join(' ')}
                  {address.country && `, ${address.country}`}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Professional Information */}
          <div>
            <h3 className="text-sm sm:text-base md:text-lg font-semibold text-text-primary mb-4">Professional Information</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              {/* Identifiers */}
              <div className="col-span-2">
                <h4 className="text-sm font-medium text-text-secondary mb-2">Identifiers</h4>
              </div>

              {practitioner.identifier?.map((identifier, index) => (
                <p key={index} className="text-sm">
                  <strong className="text-text-secondary">System:</strong> {identifier.system}
                  <br />
                  <strong className="text-text-secondary">Value:</strong> {identifier.value}
                </p>
              ))}

              {/* Qualifications */}
              <div className="col-span-2 mt-2">
                <h4 className="text-sm font-medium text-text-secondary mb-2">Qualifications</h4>
              </div>

              {practitioner.qualification && practitioner.qualification.length > 0 ? (
                practitioner.qualification.map((qual, index) => (
                  <p key={index} className="text-sm">
                    {qual.code?.text || qual.code?.coding?.[0]?.display || 'No qualification recorded'}
                  </p>
                ))
              ) : (
                <p className="text-sm text-text-secondary col-span-2">No qualifications recorded</p>
              )}
            </div>
          </div>

          <Separator />

          {/* System Information */}
          <div>
            <h3 className="text-sm sm:text-base md:text-lg font-semibold text-text-primary mb-4">System Information</h3>
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-text-secondary mb-2">Resource Metadata</h4>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                <p><strong className="text-text-secondary">Resource Type:</strong> {practitioner.resourceType}</p>
                <p><strong className="text-text-secondary">Resource ID:</strong> {practitioner.id}</p>
                {versionId && <p><strong className="text-text-secondary">Version ID:</strong> {versionId}</p>}
                {lastUpdated && (
                  <p className={versionId ? '' : 'col-span-2'}>
                    <strong className="text-text-secondary">Last Updated:</strong> {new Date(lastUpdated).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Raw FHIR Data (Accordion) */}
          <Accordion type="single" collapsible>
            <AccordionItem value="raw-fhir">
              <AccordionTrigger>Raw FHIR Data</AccordionTrigger>
              <AccordionContent>
                <pre className="bg-gray-50 p-4 rounded-lg text-xs overflow-auto max-h-96 border">
                  <code>{JSON.stringify(practitioner, null, 2)}</code>
                </pre>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

        </div>

        <Separator className="my-4" />

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}