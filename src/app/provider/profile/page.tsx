'use client';

import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/common/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { useAuth } from '@/components/auth/AuthProvider';
import type { Organization } from '@/types/fhir';

export default function ClinicProfile() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'contact' | 'settings'>('overview');
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  // Settings state
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [appointmentReminders, setAppointmentReminders] = useState(true);

  useEffect(() => {
    fetchOrganizationData();
  }, []);

  const fetchOrganizationData = async () => {
    setLoading(true);
    try {
      // Fetch HealerMy Clinic organization by name
      const response = await fetch(`/api/fhir/organizations?name=HealerMy Clinic&active=true&_count=1`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Organization data:', data);
        if (data.entry && data.entry.length > 0) {
          setOrganization(data.entry[0].resource);
        } else {
          console.warn('No organizations found in FHIR server');
        }
      } else {
        console.error('Failed to fetch organization:', response.status);
      }
    } catch (error) {
      console.error('Error fetching organization data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOrganizationName = () => {
    return organization?.name || 'Healthcare Clinic';
  };

  const getOrganizationType = () => {
    return organization?.type?.[0]?.text ||
           organization?.type?.[0]?.coding?.[0]?.display ||
           'Healthcare Provider';
  };

  const getEmail = () => {
    return organization?.telecom?.find((t: any) => t.system === 'email')?.value || 'Not provided';
  };

  const getPhone = () => {
    return organization?.telecom?.find((t: any) => t.system === 'phone')?.value || 'Not provided';
  };

  const getAddress = () => {
    if (!organization?.address?.[0]) return 'Not provided';
    const addr = organization.address[0];
    if (addr.text) return addr.text;

    const parts = [
      ...(addr.line || []),
      [addr.city, addr.state, addr.postalCode].filter(Boolean).join(', '),
      addr.country
    ].filter(Boolean);

    return parts.join(', ') || 'Not provided';
  };

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'contact' as const, label: 'Contact & Location' },
    { id: 'settings' as const, label: 'Settings' }
  ];

  if (loading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
            <div className="h-64 bg-gray-200 rounded mb-4"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl sm:text-3xl font-bold text-text-primary mb-2">Clinic Profile</h1>
          <p className="text-text-secondary">Manage your clinic information and settings</p>
        </div>

        {organization ? (
          <>
            {/* Clinic Header Card */}
            <Card className="mb-6 bg-gradient-to-r from-primary to-blue-600 text-white">
              <div className="flex items-center space-x-4">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-primary text-2xl sm:text-3xl font-bold">
                  <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl sm:text-2xl font-bold">{getOrganizationName()}</h2>
                  <p className="text-blue-100">{getEmail()}</p>
                  <div className="flex gap-2 mt-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white text-primary">
                      {getOrganizationType()}
                    </span>
                    <Badge variant={organization.active ? 'success' : 'danger'} size="sm">
                      {organization.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>

            {/* Tabs */}
            <Card className="mb-6">
              <div className="flex space-x-4 border-b">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                      activeTab === tab.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </Card>

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <Card>
                <h3 className="text-base sm:text-lg md:text-xl font-semibold mb-4">Clinic Overview</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Organization Name
                    </label>
                    <p className="text-sm sm:text-base md:text-lg font-semibold text-text-primary">
                      {getOrganizationName()}
                    </p>
                    {organization.alias && organization.alias.length > 0 && (
                      <p className="text-sm text-text-secondary mt-1">
                        Also known as: {organization.alias.join(', ')}
                      </p>
                    )}
                  </div>

                  {organization.type && organization.type.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">
                        Organization Type
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {organization.type.map((type: any, idx: number) => (
                          <Badge key={idx} variant="info" size="sm">
                            {type.text || type.coding?.[0]?.display || 'Healthcare Provider'}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Status
                    </label>
                    <Badge variant={organization.active ? 'success' : 'danger'} size="sm">
                      {organization.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </Card>
            )}

            {activeTab === 'contact' && (
              <Card>
                <h3 className="text-base sm:text-lg md:text-xl font-semibold mb-4">Contact & Location Information</h3>
                <div className="space-y-6">
                  {/* Contact Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1">
                        Phone
                      </label>
                      <p className="text-text-primary">{getPhone()}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1">
                        Email
                      </label>
                      <p className="text-text-primary">{getEmail()}</p>
                    </div>
                  </div>

                  {/* Address */}
                  {organization.address && organization.address.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1">
                        Address
                      </label>
                      {organization.address.map((addr: any, idx: number) => (
                        <div key={idx} className="bg-gray-50 p-4 rounded-lg mb-2">
                          {addr.text && <p className="text-text-primary">{addr.text}</p>}
                          {!addr.text && (
                            <>
                              {addr.line && addr.line.map((line: string, lineIdx: number) => (
                                <p key={lineIdx} className="text-text-primary">{line}</p>
                              ))}
                              <p className="text-text-primary">
                                {[addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ')}
                              </p>
                              {addr.country && <p className="text-text-secondary text-sm mt-1">{addr.country}</p>}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Contact Persons */}
                  {organization.contact && organization.contact.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">
                        Contact Persons
                      </label>
                      <div className="space-y-2">
                        {organization.contact.map((contact: any, idx: number) => (
                          <div key={idx} className="bg-gray-50 p-3 rounded-lg">
                            {contact.name?.text && (
                              <p className="font-medium text-text-primary">{contact.name.text}</p>
                            )}
                            {contact.purpose?.coding?.[0]?.display && (
                              <p className="text-sm text-text-secondary">
                                {contact.purpose.coding[0].display}
                              </p>
                            )}
                            {contact.telecom && contact.telecom.length > 0 && (
                              <p className="text-sm text-text-primary mt-1">
                                {contact.telecom.map((t: any) => t.value).filter(Boolean).join(', ')}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {activeTab === 'settings' && (
              <Card>
                <h3 className="text-base sm:text-lg md:text-xl font-semibold mb-4">Notification Settings</h3>

                <div className="space-y-4 mb-6">
                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <p className="font-medium text-text-primary">Email Notifications</p>
                      <p className="text-sm text-text-secondary">Receive appointment updates via email</p>
                    </div>
                    <button
                      onClick={() => setEmailNotifications(!emailNotifications)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        emailNotifications ? 'bg-primary' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          emailNotifications ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <p className="font-medium text-text-primary">SMS Notifications</p>
                      <p className="text-sm text-text-secondary">Receive urgent updates via SMS</p>
                    </div>
                    <button
                      onClick={() => setSmsNotifications(!smsNotifications)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        smsNotifications ? 'bg-primary' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          smsNotifications ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <p className="font-medium text-text-primary">Appointment Reminders</p>
                      <p className="text-sm text-text-secondary">Daily summary of upcoming appointments</p>
                    </div>
                    <button
                      onClick={() => setAppointmentReminders(!appointmentReminders)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        appointmentReminders ? 'bg-primary' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          appointmentReminders ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="pt-6 border-t">
                  <h4 className="text-sm sm:text-base md:text-lg font-semibold mb-4">Clinic Management</h4>
                  <div className="space-y-3">
                    <Button variant="outline" className="w-full md:w-auto">
                      Update Clinic Information
                    </Button>
                    <Button variant="outline" className="w-full md:w-auto ml-0 md:ml-3">
                      Download Clinic Data
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <p className="text-text-secondary mb-2">No clinic information available</p>
              <p className="text-sm text-text-secondary">
                Please ensure Organization data is configured in the FHIR server
              </p>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
}
