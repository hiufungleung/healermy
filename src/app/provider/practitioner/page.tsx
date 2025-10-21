'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/common/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { SkeletonCard, Skeleton } from '@/components/common/ContentSkeleton';
import { PractitionerSearch } from '@/components/common/PractitionerSearch';
import { CreatePractitionerForm } from '@/components/provider/CreatePractitionerForm';
import { ViewPractitionerDetails } from '@/components/provider/ViewPractitionerDetails';
import type { Practitioner } from '@/types/fhir';

// Custom skeleton component for practitioner cards - matches exact layout
function PractitionerSkeleton() {
  return (
    <Card className="animate-pulse">
      <div className="grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto] gap-x-4 gap-y-3">
        {/* Avatar skeleton */}
        <div className="row-span-full">
          <div className="w-16 h-16 bg-gray-200 rounded-lg"></div>
        </div>

        {/* Content skeleton */}
        <div className="min-w-0">
          {/* Name and qualifications */}
          <div className="mb-2">
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>

          {/* Contact grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mb-3">
            {/* Address */}
            <div className="flex items-start sm:col-span-2">
              <div className="w-4 h-4 bg-gray-200 rounded mr-2 mt-0.5 flex-shrink-0"></div>
              <Skeleton className="h-4 w-64" />
            </div>

            {/* Phone */}
            <div className="flex items-center">
              <div className="w-4 h-4 bg-gray-200 rounded mr-1"></div>
              <Skeleton className="h-4 w-24" />
            </div>

            {/* Email */}
            <div className="flex items-center">
              <div className="w-4 h-4 bg-gray-200 rounded mr-1"></div>
              <Skeleton className="h-4 w-32" />
            </div>
          </div>

          {/* Professional info */}
          <div className="flex items-center gap-4 mb-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>

          {/* Gender badge */}
          <div className="mb-3">
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>

          {/* Resource info */}
          <div className="mt-4 pt-3 border-t border-gray-100">
            <Skeleton className="h-3 w-32" />
          </div>
        </div>

        {/* Action buttons skeleton */}
        <div className="col-start-2 sm:col-start-3 sm:row-start-1 sm:row-span-full flex sm:flex-col gap-2 sm:min-w-[160px]">
          <Skeleton className="h-8 w-24 sm:w-full rounded-md" />
          <Skeleton className="h-8 w-32 sm:w-full rounded-md" />
        </div>
      </div>
    </Card>
  );
}

export default function PractitionerManagement() {
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
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedPractitioner, setSelectedPractitioner] = useState<Practitioner | null>(null);
  const [showViewDetails, setShowViewDetails] = useState(false);

  const fetchPractitioners = useCallback(async (page = 1, isSearch = false) => {
    if (isSearch || page === 1) {
      setLoading(true);
    }
    
    try {
      const params = new URLSearchParams();
      
      // Add FHIR-compliant search parameters with :contains for partial matching
      if (searchFilters.givenName && searchFilters.givenName.length >= 2) {
        params.append('given:contains', searchFilters.givenName);
      }
      if (searchFilters.familyName && searchFilters.familyName.length >= 2) {
        params.append('family:contains', searchFilters.familyName);
      }
      if (searchFilters.phone) {
        params.append('phone:contains', searchFilters.phone);
      }
      if (searchFilters.addressCity) {
        params.append('address-city:contains', searchFilters.addressCity);
      }
      if (searchFilters.addressState) {
        params.append('address-state:contains', searchFilters.addressState);
      }
      if (searchFilters.addressPostalCode) {
        params.append('address-postalcode:contains', searchFilters.addressPostalCode);
      }
      if (searchFilters.addressCountry) {
        params.append('address-country:contains', searchFilters.addressCountry);
      }
      if (searchFilters.practitionerId) {
        params.append('_id', searchFilters.practitionerId);
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
      console.log('Fetched practitioners:', result);
      
      if (page === 1) {
        // First page or new search - replace practitioners
        setPractitioners(result.practitioners || []);
      } else {
        // Next page - append practitioners  
        setPractitioners(prev => [...prev, ...(result.practitioners || [])]);
      }
      
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

  // Load practitioners when search filters change
  useEffect(() => {
    fetchPractitioners(1, true);
  }, [searchFilters.givenName, searchFilters.familyName, searchFilters.phone, searchFilters.addressCity, searchFilters.addressState, searchFilters.addressPostalCode, searchFilters.addressCountry, searchFilters.practitionerId, fetchPractitioners]);

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
  }, []);

  const handleNextPage = () => {
    if (hasNextPage && !loading) {
      fetchPractitioners(currentPage + 1, false);
    }
  };


  const handleCreateNew = () => {
    setShowCreateForm(true);
  };

  const handleCreateSuccess = () => {
    // Refresh the practitioner list after successful creation
    fetchPractitioners(1, false);
  };


  const handleViewDetails = (practitioner: Practitioner) => {
    setSelectedPractitioner(practitioner);
    setShowViewDetails(true);
  };

  const handleManageSchedule = (practitioner: Practitioner) => {
    router.push(`/provider/practitioner/${practitioner.id}`);
  };



  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <h1 className="text-xl sm:text-2xl sm:text-2xl font-bold text-text-primary">
              Practitioner
            </h1>
            {/* <Button
              variant="primary"
              onClick={handleCreateNew}
              className="flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create New Practitioner
            </Button> */}
          </div>
        </div>

        {/* Practitioner Search Component */}
        <PractitionerSearch
          onFiltersChange={handleFiltersChange}
          loading={loading}
          showAdvancedFilters={true}
          showOracleIdField={true}
        />

        {/* Practitioner List */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <PractitionerSkeleton key={index} />
            ))}
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
              
              // Extract identifiers for display (NPI, Provider Number, etc.)
              const npi = practitioner.identifier?.find(id => 
                id.type?.coding?.[0]?.code === 'NPI'
              )?.value;
              
              const providerNumber = practitioner.identifier?.find(id =>
                id.type?.coding?.[0]?.code === 'PRN'
              )?.value;

              return (
                <Card key={practitioner.id} className="hover:shadow-md transition-shadow">
                  {/* Grid Layout:
                      - Mobile: 2 columns (avatar + content), buttons below
                      - Tablet+: 3 columns (avatar | content | buttons)
                  */}
                  <div className="grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto] gap-x-4 gap-y-3">
                    {/* Avatar - spans 1 column, all rows */}
                    <div className="row-span-full">
                      <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    </div>

                    {/* Practitioner Details - Main content column */}
                    <div className="min-w-0">
                      {/* Name and Qualifications */}
                      <div className="mb-2">
                        <h3 className="text-base sm:text-lg font-semibold text-text-primary">{displayName}</h3>
                        {qualifications.length > 0 && (
                          <p className="text-sm text-primary font-medium">{qualifications.join(', ')}</p>
                        )}
                      </div>

                      {/* Contact & Location Grid - responsive, phone moves up on tablet+ */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mb-3">
                        {/* Location */}
                        {addressString && (
                          <div className="flex items-start sm:col-span-2">
                            <svg className="w-4 h-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <p className="text-sm text-text-secondary break-words">{addressString}</p>
                          </div>
                        )}

                        {/* Phone */}
                        {phone && (
                          <div className="flex items-center">
                            <svg className="w-4 h-4 text-gray-400 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <span className="text-sm text-text-secondary">{phone}</span>
                          </div>
                        )}

                        {/* Email */}
                        {email && (
                          <div className="flex items-center min-w-0">
                            <svg className="w-4 h-4 text-gray-400 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span className="text-sm text-text-secondary truncate">{email}</span>
                          </div>
                        )}
                      </div>

                      {/* Professional Info - only render if exists */}
                      {(npi || providerNumber) && (
                        <div className="flex flex-wrap items-center gap-4 mb-3">
                          {npi && (
                            <p className="text-xs text-text-secondary">NPI: {npi}</p>
                          )}
                          {providerNumber && (
                            <p className="text-xs text-text-secondary">Provider #: {providerNumber}</p>
                          )}
                        </div>
                      )}

                      {/* Gender - only render if exists */}
                      {practitioner.gender && (
                        <div className="mb-3">
                          <span className="inline-flex items-center px-2 py-1 bg-gray-100 rounded text-xs text-text-secondary capitalize">
                            {practitioner.gender}
                          </span>
                        </div>
                      )}

                      {/* Resource Information */}
                      <div className="mt-4 pt-3 border-t border-gray-100">
                        <div className="text-xs text-text-secondary">
                          <span>ID: {practitioner.id}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons:
                        - Mobile: Below content, fit to content width
                        - Tablet+: Right column, vertical stack
                    */}
                    <div className="col-start-2 sm:col-start-3 sm:row-start-1 sm:row-span-full flex sm:flex-col gap-2 sm:justify-start sm:min-w-[160px]">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleViewDetails(practitioner)}
                        className="whitespace-nowrap"
                      >
                        View Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleManageSchedule(practitioner)}
                        className="flex items-center justify-center whitespace-nowrap"
                      >
                        <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="truncate">Manage Schedule</span>
                      </Button>
                    </div>
                  </div>
                </Card>
              );
              })}
            </div>
            
            {/* Load More Button */}
            {hasNextPage && (
              <div className="mt-8 text-center">
                <Button
                  variant="outline"
                  onClick={handleNextPage}
                  disabled={loading}
                >
                  {loading ? 'Loading...' : 'Load More'}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h3 className="text-sm sm:text-base md:text-lg font-medium text-text-primary mb-2">
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
                'No practitioners found in the system.'
              )}
            </p>
            {!loading && !searchFilters.givenName && !searchFilters.familyName && !searchFilters.phone && !searchFilters.addressCity && !searchFilters.addressState && !searchFilters.addressPostalCode && !searchFilters.addressCountry && !searchFilters.practitionerId && (
              <div className="space-y-2">
                <p className="text-sm text-text-secondary">
                  Try searching for &quot;Dr&quot; or a specific practitioner name
                </p>
                <Button
                  variant="primary"
                  onClick={handleCreateNew}
                  className="mt-4"
                >
                  Create Your First Practitioner
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Create Form Modal */}
        <CreatePractitionerForm
          isOpen={showCreateForm}
          onClose={() => setShowCreateForm(false)}
          onSuccess={handleCreateSuccess}
        />


        {/* View Details Modal */}
        <ViewPractitionerDetails
          practitioner={selectedPractitioner}
          isOpen={showViewDetails}
          onClose={() => {
            setShowViewDetails(false);
            setSelectedPractitioner(null);
          }}
          onEdit={() => {}}
        />
      </div>
    </Layout>
  );
}