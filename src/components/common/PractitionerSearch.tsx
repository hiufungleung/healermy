'use client';

import React, { useState, useEffect } from 'react';

const SPECIALTIES = [
  'General Practice',
  'Internal Medicine',
  'Cardiology',
  'Dermatology',
  'Emergency Medicine',
  'Family Medicine',
  'Gastroenterology',
  'Neurology',
  'Oncology',
  'Pediatrics',
  'Psychiatry',
  'Radiology',
  'Surgery',
  'Orthopedics',
  'Ophthalmology',
  'Anesthesiology',
  'Pathology',
  'Obstetrics and Gynecology',
  'Urology',
  'Endocrinology',
];

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'zh', name: 'Chinese (Mandarin)' },
  { code: 'yue', name: 'Chinese (Cantonese)' },
  { code: 'ar', name: 'Arabic' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'it', name: 'Italian' },
  { code: 'es', name: 'Spanish' },
  { code: 'hi', name: 'Hindi' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'th', name: 'Thai' },
  { code: 'tr', name: 'Turkish' },
  { code: 'pl', name: 'Polish' },
  { code: 'nl', name: 'Dutch' },
  { code: 'sv', name: 'Swedish' },
  { code: 'da', name: 'Danish' },
  { code: 'no', name: 'Norwegian' },
];

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
  totalCount?: number | undefined;
  showAdvancedFilters?: boolean;
  showOracleIdField?: boolean;
}

export function PractitionerSearch({ 
  onFiltersChange, 
  loading = false, 
  resultsCount = 0, 
  totalCount,
  showAdvancedFilters = true,
  showOracleIdField = false
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
      {/* FHIR Search Filters */}
      {showAdvancedFilters && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
          {/* Given Name */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Given Name
            </label>
            <input
              type="text"
              placeholder="First name..."
              value={givenName}
              onChange={(e) => setGivenName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Family Name */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Family Name
            </label>
            <input
              type="text"
              placeholder="Last name..."
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Phone
            </label>
            <input
              type="text"
              placeholder="Phone number..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Practitioner ID */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Practitioner ID
            </label>
            <input
              type="text"
              placeholder="ID..."
              value={practitionerId}
              onChange={(e) => setPractitionerId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Address City */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              City
            </label>
            <input
              type="text"
              placeholder="City..."
              value={addressCity}
              onChange={(e) => setAddressCity(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Address State */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              State
            </label>
            <input
              type="text"
              placeholder="State..."
              value={addressState}
              onChange={(e) => setAddressState(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Address Postal Code */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Postal Code
            </label>
            <input
              type="text"
              placeholder="Postal code..."
              value={addressPostalCode}
              onChange={(e) => setAddressPostalCode(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Address Country */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Country
            </label>
            <input
              type="text"
              placeholder="Country..."
              value={addressCountry}
              onChange={(e) => setAddressCountry(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
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
          <input
            type="text"
            placeholder="Search by given name..."
            value={givenName}
            onChange={(e) => setGivenName(e.target.value)}
            className="w-full pl-10 pr-10 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <svg className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {givenName && (
            <button
              onClick={() => setGivenName('')}
              className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Results Summary */}
      {!loading && (
        <div className="text-sm text-text-secondary">
          {hasActiveFilters ? (
            <span>
              Showing {resultsCount} results with {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
            </span>
          ) : (
            <span>
              Showing {resultsCount} practitioners
              {totalCount ? ` (${totalCount} total)` : ''}
            </span>
          )}
        </div>
      )}
    </div>
  );
}