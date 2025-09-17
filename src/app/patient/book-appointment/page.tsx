'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/common/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { ContentContainer } from '@/components/common/ContentContainer';
import { ProgressSteps } from '@/components/common/ProgressSteps';
import { PractitionerSearch } from '@/components/common/PractitionerSearch';
import { formatTimeForDisplay } from '@/lib/timezone';
import type { Practitioner } from '@/types/fhir';

export default function BookAppointment() {
  const router = useRouter();
  
  const [searchFilters, setSearchFilters] = useState({
    givenName: '',
    familyName: '',
    phone: '',
    addressCity: '',
    addressState: '',
    addressPostalCode: '',
    addressCountry: '',
    practitionerId: ''
  });
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPractitioners, setTotalPractitioners] = useState<number | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  // Expandable cards state
  const [expandedPractitionerId, setExpandedPractitionerId] = useState<string | null>(null);
  const [practitionerSlots, setPractitionerSlots] = useState<Record<string, Record<string, any[]>>>({});
  const [slotsLoading, setSlotsLoading] = useState<Record<string, boolean>>({});
  const [selectedDates, setSelectedDates] = useState<Record<string, string>>({});
  const [selectedSlots, setSelectedSlots] = useState<Record<string, string>>({});

  const fetchPractitioners = useCallback(async (page = 1, isSearch = false) => {
    if (isSearch || page === 1) {
      setLoading(true);
    }
    
    try {
      const params = new URLSearchParams();
      
      // Add FHIR-compliant search parameters
      if (searchFilters.givenName && searchFilters.givenName.length >= 2) {
        params.append('givenName', searchFilters.givenName);
      }
      if (searchFilters.familyName && searchFilters.familyName.length >= 2) {
        params.append('familyName', searchFilters.familyName);
      }
      if (searchFilters.phone) {
        params.append('phone', searchFilters.phone);
      }
      if (searchFilters.addressCity) {
        params.append('addressCity', searchFilters.addressCity);
      }
      if (searchFilters.addressState) {
        params.append('addressState', searchFilters.addressState);
      }
      if (searchFilters.addressPostalCode) {
        params.append('addressPostalCode', searchFilters.addressPostalCode);
      }
      if (searchFilters.addressCountry) {
        params.append('addressCountry', searchFilters.addressCountry);
      }
      if (searchFilters.practitionerId) {
        params.append('practitionerId', searchFilters.practitionerId);
      }
      
      // Add pagination - 30 practitioners per page
      params.append('count', '30');
      if (page > 1) {
        params.append('page', page.toString());
      }
      
      const response = await fetch(`/api/fhir/practitioners?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          // Authentication required - middleware will handle redirect
          console.log('Authentication required, middleware will redirect');
          return;
        }
        throw new Error(`Failed to fetch practitioners: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (page === 1) {
        // First page or new search - replace practitioners
        setPractitioners(result.practitioners || []);
      } else {
        // Next page - append practitioners  
        setPractitioners(prev => [...prev, ...(result.practitioners || [])]);
      }
      
      setTotalPractitioners(result.total);
      setHasNextPage(!!result.nextUrl);
      setCurrentPage(page);
      
    } catch (error) {
      console.error('Error fetching practitioners:', error);
      if (page === 1) {
        setPractitioners([]);
      }
    } finally {
      setLoading(false);
    }
  }, [searchFilters.givenName, searchFilters.familyName, searchFilters.phone, searchFilters.addressCity, searchFilters.addressState, searchFilters.addressPostalCode, searchFilters.addressCountry, searchFilters.practitionerId]);

  // Handle search filter changes
  const handleFiltersChange = useCallback((filters: {
    givenName: string;
    familyName: string;
    phone: string;
    addressCity: string;
    addressState: string;
    addressPostalCode: string;
    addressCountry: string;
    practitionerId: string;
  }) => {
    setSearchFilters(filters);
    setCurrentPage(1);
    fetchPractitioners(1, true);
  }, [fetchPractitioners]);

  // Load all active practitioners on mount
  useEffect(() => {
    fetchPractitioners(1, false); // page 1, not a search
  }, [fetchPractitioners]);

  // Optimized slot fetching for next 7 days to reduce API calls
  const fetchSlotsForPractitioner = async (practitionerId: string) => {
    try {
      console.log('Fetching 7-day schedules for practitioner:', practitionerId);

      // First get schedules for this practitioner
      const schedulesResponse = await fetch(`/api/fhir/schedules?actor=Practitioner/${practitionerId}`, {
        credentials: 'include',
      });

      if (!schedulesResponse.ok) {
        console.error('Schedules API failed with status:', schedulesResponse.status, schedulesResponse.statusText);
        return {};
      }

      const schedulesData = await schedulesResponse.json();
      console.log('Schedules data:', schedulesData);

      if (!schedulesData.schedules || schedulesData.schedules.length === 0) {
        console.log('No schedules found for practitioner');
        return {};
      }

      const scheduleIds = schedulesData.schedules.map((s: any) => s.id);
      console.log('Schedule IDs:', scheduleIds);

      // Calculate date range for next 7 days including today
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 6); // 7 days total (today + next 6)
      endDate.setHours(23, 59, 59, 999);

      console.log('Fetching slots for date range:', startDate.toISOString(), 'to', endDate.toISOString());

      // Fetch more slots to cover 7 days
      const response = await fetch(`/api/fhir/slots?_count=200`, {
        credentials: 'include',
      });

      if (!response.ok) {
        console.error('Slots API failed with status:', response.status, response.statusText);
        return {};
      }

      const result = await response.json();
      const allSlots = result.slots || [];
      console.log('Total slots from API:', allSlots.length);

      // Filter slots that belong to this practitioner's schedules
      const practitionerSlots = allSlots.filter((slot: any) =>
        scheduleIds.some((scheduleId: string) => slot.schedule?.reference === `Schedule/${scheduleId}`)
      );

      console.log('Filtered practitioner slots:', practitionerSlots.length);

      // Filter by date range and free status, then organize by date
      const slotsByDate: Record<string, any[]> = {};

      practitionerSlots.forEach((slot: any) => {
        const slotStart = new Date(slot.start);
        if (slot.status === 'free' && slotStart >= startDate && slotStart <= endDate) {
          const dateKey = slotStart.toISOString().split('T')[0]; // YYYY-MM-DD format
          if (!slotsByDate[dateKey]) {
            slotsByDate[dateKey] = [];
          }
          slotsByDate[dateKey].push(slot);
        }
      });

      console.log('Slots organized by date:', Object.keys(slotsByDate).map(date => `${date}: ${slotsByDate[date].length} slots`));
      return slotsByDate;

    } catch (error) {
      console.error('Error fetching slots:', error);
      return {};
    }
  };

  const handleBookNow = async (practitioner: Practitioner) => {
    // Check if this card is already expanded
    if (expandedPractitionerId === practitioner.id) {
      // Card is expanded, collapse it
      setExpandedPractitionerId(null);
      return;
    }

    // Expand this card and fetch slots for next 7 days
    setExpandedPractitionerId(practitioner.id);
    setSlotsLoading(prev => ({ ...prev, [practitioner.id]: true }));

    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    setSelectedDates(prev => ({ ...prev, [practitioner.id]: today }));

    // Fetch slots for all 7 days (organized by date)
    const slotsByDate = await fetchSlotsForPractitioner(practitioner.id);
    setPractitionerSlots(prev => ({ ...prev, [practitioner.id]: slotsByDate }));
    setSlotsLoading(prev => ({ ...prev, [practitioner.id]: false }));
  };

  const handleNextPage = () => {
    if (hasNextPage && !loading) {
      fetchPractitioners(currentPage + 1, false);
    }
  };


  return (
    <Layout>
      <ContentContainer size="lg">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            Book New Appointment
          </h1>
          <p className="text-text-secondary">
            Find and book with the right clinic for you
          </p>
        </div>

        {/* Progress Steps - Updated for combined flow */}
        <ProgressSteps
          steps={[
            { id: 1, label: 'Search & Select', status: 'active' },
            { id: 2, label: 'Confirm', status: 'upcoming' },
            { id: 3, label: 'Complete', status: 'upcoming' }
          ]}
          currentStep={1}
        />

        {/* Practitioner Search */}
        <PractitionerSearch
          onFiltersChange={handleFiltersChange}
          loading={loading}
          resultsCount={practitioners.length}
          totalCount={totalPractitioners}
          showAdvancedFilters={true}
          showOracleIdField={true}
        />

        {/* Practitioner List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-2 text-text-secondary">Loading practitioners...</p>
          </div>
        ) : practitioners.length > 0 ? (
          <>
            <div className="space-y-4">
              {practitioners.map((practitioner) => {
              const name = practitioner.name?.[0];
              const displayName = name?.text || 
                `${name?.prefix?.join(' ') || ''} ${name?.given?.join(' ') || ''} ${name?.family || ''}`.trim() ||
                'Unknown Practitioner';
              
              // Extract qualifications - show all degrees/certifications
              const qualifications = practitioner.qualification?.map(q => 
                q.code?.text || q.code?.coding?.[0]?.display
              ).filter(Boolean) || [];
              
              // Extract primary address
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
              
              // Extract identifiers for display (NPI, etc.)
              const npi = practitioner.identifier?.find(id => 
                id.type?.coding?.[0]?.code === 'NPI'
              )?.value;

              return (
                <Card key={practitioner.id} className="hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div className="flex space-x-4">
                      <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="text-xl font-semibold text-text-primary">{displayName}</h3>
                            {qualifications.length > 0 && (
                              <p className="text-sm text-primary font-medium">{qualifications.join(', ')}</p>
                            )}
                          </div>
                          <div className="flex items-center ml-4">
                            {practitioner.active ? (
                              <Badge variant="success" size="sm">Active</Badge>
                            ) : (
                              <Badge variant="danger" size="sm">Inactive</Badge>
                            )}
                          </div>
                        </div>
                        
                        {/* Location */}
                        {addressString && (
                          <div className="flex items-start mb-2">
                            <svg className="w-4 h-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <p className="text-sm text-text-secondary">{addressString}</p>
                          </div>
                        )}
                        
                        {/* Contact Information */}
                        <div className="flex flex-wrap items-center gap-4 mb-3">
                          {phone && (
                            <div className="flex items-center">
                              <svg className="w-4 h-4 text-gray-400 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                              <span className="text-sm text-text-secondary">{phone}</span>
                            </div>
                          )}
                          {email && (
                            <div className="flex items-center">
                              <svg className="w-4 h-4 text-gray-400 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              <span className="text-sm text-text-secondary">{email}</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Professional Info */}
                        {npi && (
                          <div className="mb-3">
                            <p className="text-xs text-text-secondary">NPI: {npi}</p>
                          </div>
                        )}
                        
                        {/* Gender */}
                        {practitioner.gender && (
                          <div className="mb-3">
                            <span className="inline-flex items-center px-2 py-1 bg-gray-100 rounded text-xs text-text-secondary capitalize">
                              {practitioner.gender}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="ml-4 flex-shrink-0">
                      <Button
                        variant={practitioner.active ? "primary" : "outline"}
                        onClick={() => handleBookNow(practitioner)}
                        disabled={!practitioner.active || slotsLoading[practitioner.id]}
                      >
                        {slotsLoading[practitioner.id]
                          ? 'Loading...'
                          : expandedPractitionerId === practitioner.id
                            ? 'Collapse'
                            : practitioner.active
                              ? 'Book Now'
                              : 'Unavailable'
                        }
                      </Button>
                    </div>
                  </div>

                  {/* Expandable Content */}
                  {expandedPractitionerId === practitioner.id && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <h3 className="text-lg font-semibold mb-4">Select Date & Time</h3>

                      {/* Date Selection */}
                      <div className="mb-6">
                        <h4 className="font-medium mb-3">Choose Date</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2">
                          {Array.from({ length: 7 }, (_, i) => {
                            const date = new Date();
                            date.setDate(date.getDate() + i);
                            const dateStr = date.toISOString().split('T')[0];
                            const isSelected = selectedDates[practitioner.id] === dateStr;
                            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                            const dayNum = date.getDate();
                            const month = date.toLocaleDateString('en-US', { month: 'short' });

                            return (
                              <button
                                key={dateStr}
                                onClick={async () => {
                                  setSelectedDates(prev => ({ ...prev, [practitioner.id]: dateStr }));
                                  setSlotsLoading(prev => ({ ...prev, [practitioner.id]: true }));
                                  const slots = await fetchSlotsForPractitioner(practitioner.id, dateStr);
                                  setPractitionerSlots(prev => ({ ...prev, [practitioner.id]: slots }));
                                  setSlotsLoading(prev => ({ ...prev, [practitioner.id]: false }));
                                }}
                                className={`p-3 rounded-lg border text-center transition-colors ${
                                  isSelected
                                    ? 'bg-primary text-white border-primary'
                                    : 'bg-white hover:bg-gray-50 border-gray-200'
                                }`}
                              >
                                <div className="text-xs">{dayName}</div>
                                <div className="font-semibold">{dayNum}</div>
                                <div className="text-xs">{month}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Time Slot Selection */}
                      <div className="mb-6">
                        <h4 className="font-medium mb-3">Available Times</h4>
                        {slotsLoading[practitioner.id] ? (
                          <div className="text-center py-8">
                            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                            <p className="mt-2 text-text-secondary">Loading available times...</p>
                          </div>
                        ) : !practitionerSlots[practitioner.id]?.[selectedDates[practitioner.id] || ''] || practitionerSlots[practitioner.id]?.[selectedDates[practitioner.id] || '']?.length === 0 ? (
                          <div className="text-center py-8">
                            <p className="text-text-secondary">No available time slots for this date.</p>
                            <p className="text-sm text-text-secondary mt-2">Please try a different date.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {practitionerSlots[practitioner.id]?.[selectedDates[practitioner.id] || '']?.map((slot: any) => {
                              const timeDisplay = formatTimeForDisplay(slot.start);
                              const isSelected = selectedSlots[practitioner.id] === slot.id;

                              return (
                                <button
                                  key={slot.id}
                                  onClick={() => {
                                    setSelectedSlots(prev => ({ ...prev, [practitioner.id]: slot.id }));
                                  }}
                                  className={`p-3 rounded-lg border text-center transition-colors ${
                                    isSelected
                                      ? 'bg-primary text-white border-primary'
                                      : 'bg-white hover:bg-gray-50 border-gray-200'
                                  }`}
                                >
                                  {timeDisplay}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Next Button */}
                      {selectedSlots[practitioner.id] && (
                        <div className="flex justify-end">
                          <Button
                            variant="primary"
                            onClick={() => {
                              const selectedSlotId = selectedSlots[practitioner.id];
                              const selectedDate = selectedDates[practitioner.id];
                              const selectedSlot = practitionerSlots[practitioner.id]?.[selectedDate]?.find((s: any) => s.id === selectedSlotId);
                              const selectedTime = selectedSlot ? formatTimeForDisplay(selectedSlot.start) : '';

                              router.push(`/patient/book-appointment/${practitioner.id}/confirm?date=${selectedDate}&time=${selectedTime}&slotId=${selectedSlotId}`);
                            }}
                          >
                            Next →
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
              })}
            </div>
            
            {/* Pagination */}
            {hasNextPage && (
              <div className="mt-8 text-center">
                <Button
                  variant="outline"
                  onClick={handleNextPage}
                  disabled={loading}
                >
                  {loading ? 'Loading...' : `Load More (${practitioners.length} of ${totalPractitioners || '???'})`}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h3 className="text-lg font-medium text-text-primary mb-2">
              {loading ? 'Loading Practitioners...' : 'No Practitioners Found'}
            </h3>
            <p className="text-text-secondary mb-4">
              {loading ? (
                'Please wait while we load practitioners...'
              ) : (searchFilters.givenName.length > 0 && searchFilters.givenName.length < 2) || (searchFilters.familyName.length > 0 && searchFilters.familyName.length < 2) ? (
                'Please enter at least 2 characters for name search'
              ) : searchFilters.givenName.length >= 2 || searchFilters.familyName.length >= 2 || searchFilters.phone || searchFilters.addressCity || searchFilters.addressState || searchFilters.addressPostalCode || searchFilters.addressCountry || searchFilters.practitionerId ? (
                'No practitioners found. Try different search criteria.'
              ) : (
                'No active practitioners found in the system.'
              )}
            </p>
            {!loading && !searchFilters.givenName && !searchFilters.familyName && !searchFilters.phone && !searchFilters.addressCity && !searchFilters.addressState && !searchFilters.addressPostalCode && !searchFilters.addressCountry && !searchFilters.practitionerId && (
              <p className="text-sm text-text-secondary">
                Try searching by practitioner name, phone number, or location
              </p>
            )}
          </div>
        )}
      </ContentContainer>
    </Layout>
  );
}