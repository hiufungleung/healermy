'use client';

import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/common/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { useAuth } from '@/components/auth/AuthProvider';
import type { Practitioner } from '@/types/fhir';

export default function PractitionerProfile() {
  const { session, userName } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'contact' | 'settings'>('overview');
  const [practitioner, setPractitioner] = useState<Practitioner | null>(null);
  const [loading, setLoading] = useState(true);

  // Settings state
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [appointmentReminders, setAppointmentReminders] = useState(true);

  useEffect(() => {
    if (session?.practitioner) {
      fetchPractitionerData();
    }
  }, [session?.practitioner]);

  const fetchPractitionerData = async () => {
    if (!session?.practitioner) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/fhir/practitioners/${session.practitioner}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setPractitioner(data);
      } else {
        console.error('Failed to fetch practitioner:', response.status);
      }
    } catch (error) {
      console.error('Error fetching practitioner data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPractitionerName = () => {
    if (!practitioner?.name?.[0]) return userName || 'Practitioner';
    const name = practitioner.name[0];
    const prefix = name.prefix?.[0] || '';
    const given = name.given?.join(' ') || '';
    const family = name.family || '';
    return `${prefix} ${given} ${family}`.trim() || userName || 'Practitioner';
  };

  const getEmail = () => {
    return practitioner?.telecom?.find((t: any) => t.system === 'email')?.value || 'Not provided';
  };

  const getPhone = () => {
    return practitioner?.telecom?.find((t: any) => t.system === 'phone')?.value || 'Not provided';
  };

  const getGender = () => {
    return practitioner?.gender || 'Not specified';
  };

  const getQualifications = () => {
    return practitioner?.qualification || [];
  };

  const getAddress = () => {
    if (!practitioner?.address?.[0]) return 'Not provided';
    const addr = practitioner.address[0];
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
          <h1 className="text-xl sm:text-2xl sm:text-3xl font-bold text-text-primary mb-2">My Profile</h1>
          <p className="text-text-secondary">Manage your professional information and settings</p>
        </div>

        {practitioner ? (
          <>
            {/* Profile Header Card */}
            <Card className="mb-6 bg-gradient-to-r from-primary to-blue-600 text-white">
              <div className="flex items-center space-x-4">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-primary text-2xl sm:text-3xl font-bold">
                  {getPractitionerName().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div className="flex-1">
                  <h2 className="text-xl sm:text-2xl font-bold">{getPractitionerName()}</h2>
                  <p className="text-blue-100">{getEmail()}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant={practitioner.active ? 'success' : 'danger'} size="sm">
                      {practitioner.active ? 'Active' : 'Inactive'}
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
                <h3 className="text-base sm:text-lg md:text-xl font-semibold mb-4">Professional Overview</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Full Name
                    </label>
                    <p className="text-sm sm:text-base md:text-lg font-semibold text-text-primary">
                      {getPractitionerName()}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Gender
                    </label>
                    <p className="text-text-primary capitalize">{getGender()}</p>
                  </div>

                  {getQualifications().length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">
                        Qualifications
                      </label>
                      <div className="space-y-2">
                        {getQualifications().map((qual: any, idx: number) => (
                          <div key={idx} className="bg-gray-50 p-3 rounded-lg">
                            <p className="font-medium text-text-primary">
                              {qual.code?.text || qual.code?.coding?.[0]?.display || 'Qualification'}
                            </p>
                            {qual.period && (
                              <p className="text-sm text-text-secondary mt-1">
                                {qual.period.start && `From: ${new Date(qual.period.start).toLocaleDateString()}`}
                                {qual.period.end && ` - To: ${new Date(qual.period.end).toLocaleDateString()}`}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Status
                    </label>
                    <Badge variant={practitioner.active ? 'success' : 'danger'} size="sm">
                      {practitioner.active ? 'Active' : 'Inactive'}
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
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Address
                    </label>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-text-primary">{getAddress()}</p>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {activeTab === 'settings' && (
              <Card>
                <h3 className="text-base sm:text-lg md:text-xl font-semibold mb-4">Notification Settings (Demo)</h3>

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
                  <h4 className="text-sm sm:text-base md:text-lg font-semibold mb-4">Account Management (Demo)</h4>
                  <div className="space-y-3">
                    <Button variant="outline" className="w-full md:w-auto">
                      Change Password
                    </Button>
                    <Button variant="outline" className="w-full md:w-auto ml-0 md:ml-3">
                      Download My Data
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <p className="text-text-secondary mb-2">No practitioner information available</p>
              <p className="text-sm text-text-secondary">
                Please ensure your Practitioner data is configured in the FHIR server
              </p>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
}
