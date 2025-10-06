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
import { FormNavigationButtons } from '@/components/common/NavigationButtons';
import {
  formatTimeForDisplay
} from '@/lib/timezone';
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
  const [error, setError] = useState<string | null>(null);
  const [totalPractitioners, setTotalPractitioners] = useState<number | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);


  const fetchPractitioners = useCallback(async (page = 1, isSearch = false) => {
    if (isSearch || page === 1) {
      setLoading(true);
    }

    setError(null); // Clear previous errors

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
        setPractitioners((prev: any[]) => [...prev, ...(result.practitioners || [])]);
      }
      
      setTotalPractitioners(result.total);
      setHasNextPage(!!result.nextUrl);
      setCurrentPage(page);
      
    } catch (error) {
      console.error('Error fetching practitioners:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load practitioners';
      setError(errorMessage);
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

  const handleBookNow = (practitioner: Practitioner) => {
    // Navigate to practitioner detail page for service selection and booking
    router.push(`/patient/book-appointment/${practitioner.id}`);
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
          showOracleIdField={false}
          showSubtitle={false}
          showPhoneField={false}
        />

        {/* Practitioner List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-2 text-text-secondary">Loading practitioners...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="flex items-center justify-center text-red-600 mb-4">
              <svg className="w-8 h-8 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-semibold">Unable to Load Practitioners</h3>
            </div>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => fetchPractitioners(1)}
              className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary"
            >
              Try Again
            </button>
          </div>
        ) : practitioners.length > 0 ? (
          <>
            <div className="space-y-4">
              {practitioners.map((practitioner: any) => {
              const name = practitioner.name?.[0];
              const displayName = name?.text || 
                `${name?.prefix?.join(' ') || ''} ${name?.given?.join(' ') || ''} ${name?.family || ''}`.trim() ||
                'Unknown Practitioner';
              
              // Extract qualifications - show all degrees/certifications
              const qualifications = practitioner.qualification?.map((q: any) =>
                q.code?.text || q.code?.coding?.[0]?.display
              ).filter(Boolean) || [];
              
              // Extract primary address - format in single line
              const address = practitioner.address?.[0];
              const addressString = address ? [
                address.line?.join(', '),
                address.city,
                address.state,
                address.postalCode
              ].filter(Boolean).join(', ') : null;
              
              // Extract contact info
              const phone = practitioner.telecom?.find((t: any) => t.system === 'phone')?.value;
              const email = practitioner.telecom?.find((t: any) => t.system === 'email')?.value;
              
              // Extract identifiers for display (NPI, etc.)
              const npi = practitioner.identifier?.find((id: any) =>
                id.type?.coding?.[0]?.code === 'NPI'
              )?.value;

              return (
                <Card key={practitioner.id} className="hover:shadow-md transition-shadow relative">
                  {/* Fixed Button - Always in top-right corner */}
                  <div className="absolute top-4 right-4 z-10">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleBookNow(practitioner)}
                      className="w-16 h-8 text-xs px-2 py-1 sm:w-20 sm:h-9 sm:text-sm sm:px-3 sm:py-2 md:w-24 md:h-10 md:text-base md:px-4 md:py-2"
                    >
                      Book
                    </Button>
                  </div>

                  <div className="flex space-x-4 pr-24">
                    {/* Avatar */}
                    <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-text-primary">{displayName}</h3>
                          {qualifications.length > 0 && (
                            <p className="text-sm text-primary font-medium">{qualifications.join(', ')}</p>
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