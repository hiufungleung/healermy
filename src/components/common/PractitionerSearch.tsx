'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';

// Reserved for future use
// const SPECIALTIES = [
//   'General Practice', 'Internal Medicine', 'Cardiology', 'Dermatology',
//   'Emergency Medicine', 'Family Medicine', 'Gastroenterology', 'Neurology',
//   'Oncology', 'Pediatrics', 'Psychiatry', 'Radiology', 'Surgery',
//   'Orthopedics', 'Ophthalmology', 'Anesthesiology', 'Pathology',
//   'Obstetrics and Gynecology', 'Urology', 'Endocrinology'
// ];

// Reserved for future use
// const LANGUAGES = [
//   { code: 'en', name: 'English' },
//   { code: 'zh', name: 'Chinese (Mandarin)' },
//   { code: 'yue', name: 'Chinese (Cantonese)' },
//   { code: 'ar', name: 'Arabic' },
//   { code: 'vi', name: 'Vietnamese' },
//   { code: 'it', name: 'Italian' },
//   { code: 'es', name: 'Spanish' },
//   { code: 'hi', name: 'Hindi' },
//   { code: 'fr', name: 'French' },
//   { code: 'de', name: 'German' },
//   { code: 'ja', name: 'Japanese' },
//   { code: 'ko', name: 'Korean' },
//   { code: 'pt', name: 'Portuguese' },
//   { code: 'ru', name: 'Russian' },
//   { code: 'th', name: 'Thai' },
//   { code: 'tr', name: 'Turkish' },
//   { code: 'pl', name: 'Polish' },
//   { code: 'nl', name: 'Dutch' },
//   { code: 'sv', name: 'Swedish' },
//   { code: 'da', name: 'Danish' },
//   { code: 'no', name: 'Norwegian' }
// ];

interface SearchFilters {
  givenName: string;
  familyName: string;
  phone: string;
  addressCity: string;
  addressState: string;
  addressPostalCode: string;
  addressCountry: string;
  practitionerId: string;
}

interface PractitionerSearchProps {
  onFiltersChange: (filters: SearchFilters) => void;
  loading?: boolean;
  resultsCount?: number;
  totalCount?: number;
  showAdvancedFilters?: boolean;
  showOracleIdField?: boolean;
  showSubtitle?: boolean;
  showPhoneField?: boolean;
}

export function PractitionerSearch({
  onFiltersChange,
  loading = false,
  resultsCount,
  totalCount,
  showAdvancedFilters = true,
  showOracleIdField = false,
  showSubtitle = true,
  showPhoneField = true
}: PractitionerSearchProps) {
  const [givenName, setGivenName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [addressPostalCode, setAddressPostalCode] = useState('');
  const [addressCountry, setAddressCountry] = useState('');
  const [practitionerId, setPractitionerId] = useState('');
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Debounced search effect
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      onFiltersChange({
        givenName,
        familyName,
        phone,
        addressCity,
        addressState,
        addressPostalCode,
        addressCountry,
        practitionerId
      });
    }, 500); // 500ms delay

    setSearchTimeout(timeout);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [givenName, familyName, phone, addressCity, addressState, addressPostalCode, addressCountry, practitionerId, onFiltersChange]);

  const handleClearSearch = () => {
    setGivenName('');
    setFamilyName('');
    setPhone('');
    setAddressCity('');
    setAddressState('');
    setAddressPostalCode('');
    setAddressCountry('');
    setPractitionerId('');
  };

  const hasActiveFilters = givenName || familyName || phone || addressCity || addressState || addressPostalCode || addressCountry || practitionerId;
  const activeFilterCount = [givenName, familyName, phone, addressCity, addressState, addressPostalCode, addressCountry, practitionerId].filter(Boolean).length;

  return (
    <div className="mb-6">
      {/* Search Tips */}
      <div className="mb-8 pb-6 border-b border-gray-200">
        <div className="flex items-center mb-2">
          <svg className="w-5 h-5 text-gray-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h3 className="text-sm sm:text-base md:text-lg font-medium text-gray-900">Find Your Doctor</h3>
        </div>
        {showSubtitle && (
          <p className="text-gray-600 text-sm">
            Search by doctor&apos;s name, location, or practitioner ID. Use multiple fields to narrow your results.
          </p>
        )}
      </div>

      {/* FHIR Search Filters */}
      {showAdvancedFilters && (
        <div className="space-y-4 mb-4">
          {/* Name Fields Row - Always 2 columns on mobile+ */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {/* Given Name */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Given Name
                <span className="text-xs text-gray-500 ml-1">(Doctor&apos;s first name)</span>
              </label>
              <Input
                type="text"
                placeholder="e.g., John, Sarah, Michael..."
                value={givenName}
                onChange={(e) => setGivenName(e.target.value)}
                className="min-h-[44px]"
              />
            </div>

            {/* Family Name */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Family Name
                <span className="text-xs text-gray-500 ml-1">(Doctor&apos;s last name)</span>
              </label>
              <Input
                type="text"
                placeholder="e.g., Smith, Johnson, Williams..."
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
          </div>

          {/* Contact Fields Row - 2 columns on mobile, responsive on larger screens */}
          {(showPhoneField || showOracleIdField) && (
            <div className="grid grid-cols-2 md:grid-cols-2 gap-3 sm:gap-4">
              {/* Phone */}
              {showPhoneField && (
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Phone Number
                    <span className="text-xs text-gray-500 ml-1">(Clinic contact)</span>
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g., (555) 123-4567 or +1234567890"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="min-h-[44px]"
                  />
                </div>
              )}

              {/* Practitioner ID */}
              {showOracleIdField && (
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Practitioner ID
                    <span className="text-xs text-gray-500 ml-1">(Oracle FHIR ID)</span>
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g., 12345 or ABC123-DEF456"
                    value={practitionerId}
                    onChange={(e) => setPractitionerId(e.target.value)}
                    className="min-h-[44px]"
                  />
                </div>
              )}
            </div>
          )}

          {/* Location Fields Row - Responsive based on screen size */}
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Address City */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                City
                <span className="text-xs text-gray-500 ml-1">(Clinic location)</span>
              </label>
              <Input
                type="text"
                placeholder="e.g., Brisbane, Sydney, Melbourne"
                value={addressCity}
                onChange={(e) => setAddressCity(e.target.value)}
                className="min-h-[44px]"
              />
            </div>

            {/* Address State */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                State/Province
                <span className="text-xs text-gray-500 ml-1">(State or region)</span>
              </label>
              <Input
                type="text"
                placeholder="e.g., QLD, NSW, VIC"
                value={addressState}
                onChange={(e) => setAddressState(e.target.value)}
                className="min-h-[44px]"
              />
            </div>

            {/* Address Postal Code */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Postal Code
                <span className="text-xs text-gray-500 ml-1">(ZIP/postal code)</span>
              </label>
              <Input
                type="text"
                placeholder="e.g., 4000, 2000, 3000"
                value={addressPostalCode}
                onChange={(e) => setAddressPostalCode(e.target.value)}
                className="min-h-[44px]"
              />
            </div>

            {/* Address Country */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Country
                <span className="text-xs text-gray-500 ml-1">(Nation)</span>
              </label>
              <Input
                type="text"
                placeholder="e.g., Australia, USA, Canada"
                value={addressCountry}
                onChange={(e) => setAddressCountry(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
          </div>
        </div>
      )}

      {/* Clear Filters Button */}
      {showAdvancedFilters && hasActiveFilters && (
        <div className="mb-4">
          <button
            onClick={handleClearSearch}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Clear All Filters
            <span className="ml-1 bg-primary text-white text-xs px-1.5 py-0.5 rounded-full">
              {activeFilterCount}
            </span>
          </button>
        </div>
      )}

      {/* Simple search for when advanced filters are disabled */}
      {!showAdvancedFilters && (
        <div className="max-w-md relative mb-4">
          <label className="block text-sm font-medium text-text-primary mb-2">
            Search Practitioners
          </label>
          <div className="relative">
            <Input
              type="text"
              placeholder="Enter doctor's first name (e.g., John, Sarah, Michael...)"
              value={givenName}
              onChange={(e) => setGivenName(e.target.value)}
              className="pl-10 pr-10 py-3"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {givenName && (
              <button
                onClick={() => setGivenName('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Results Count Display */}
      {resultsCount !== undefined && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
          <div className="flex items-center text-sm text-gray-600">
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">{resultsCount} practitioners</span>
          </div>
        </div>
      )}

    </div>
  );
}