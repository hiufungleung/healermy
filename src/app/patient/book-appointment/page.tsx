'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/common/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { useAuth } from '@/components/auth/AuthProvider';
import { searchPractitioners, searchSlots } from '@/library/fhir/client';
import type { Practitioner, Slot } from '@/types/fhir';

export default function BookAppointment() {
  const router = useRouter();
  const { session } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('General Practitioner');
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({
    vaccine: false,
    availability: 'all',
    telehealth: 'all',
    gender: 'all',
    openingHours: 'all',
    bulkBilling: 'all'
  });

  useEffect(() => {
    fetchPractitioners();
  }, [selectedSpecialty, searchQuery, location]);

  const fetchPractitioners = async () => {
    if (!session?.accessToken || !session?.fhirBaseUrl) return;
    
    setLoading(true);
    try {
      const results = await searchPractitioners(
        session.accessToken,
        session.fhirBaseUrl,
        searchQuery || undefined
      );
      setPractitioners(results);
    } catch (error) {
      console.error('Error fetching practitioners:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBookNow = (practitioner: Practitioner) => {
    router.push(`/patient/book-appointment/${practitioner.id}`);
  };

  const specialties = [
    'General Practitioner',
    'Vaccine',
    'Family Medicine',
    'Internal Medicine',
    'Pediatrics',
    'Cardiology',
    'Dermatology'
  ];

  const mockPractitioners: Practitioner[] = [
    {
      id: '1',
      resourceType: 'Practitioner' as const,
      name: [{ 
        given: ['Sarah'], 
        family: 'Johnson',
        text: 'Dr. Sarah Johnson'
      }],
      qualification: [{
        code: {
          text: 'General Practice'
        }
      }]
    },
    {
      id: '2',
      resourceType: 'Practitioner' as const,
      name: [{
        given: ['Michael'],
        family: 'Chen',
        text: 'Dr. Michael Chen'
      }],
      qualification: [{
        code: {
          text: 'Family Medicine'
        }
      }]
    },
    {
      id: '3',
      resourceType: 'Practitioner' as const,
      name: [{
        given: ['Emily'],
        family: 'Rodriguez',
        text: 'Dr. Emily Rodriguez'
      }],
      qualification: [{
        code: {
          text: 'General Practice'
        }
      }]
    }
  ];

  const displayPractitioners = practitioners.length > 0 ? practitioners : mockPractitioners;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            Book New Appointment
          </h1>
          <p className="text-text-secondary">
            Find and book with the right clinic for you
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Service, practice or practitioner"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <svg className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            <div className="relative">
              <input
                type="text"
                placeholder="Location (e.g., Toowong, QLD 4066)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <svg className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-2">
            {specialties.map((specialty) => (
              <button
                key={specialty}
                onClick={() => setSelectedSpecialty(specialty)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedSpecialty === specialty
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
                }`}
              >
                {specialty}
              </button>
            ))}
          </div>

          {/* Additional Filters */}
          <div className="flex flex-wrap gap-2">
            <select
              value={selectedFilters.availability}
              onChange={(e) => setSelectedFilters({...selectedFilters, availability: e.target.value})}
              className="px-4 py-2 border rounded-lg text-sm"
            >
              <option value="all">Availability</option>
              <option value="today">Today</option>
              <option value="tomorrow">Tomorrow</option>
              <option value="week">This Week</option>
            </select>

            <select
              value={selectedFilters.telehealth}
              onChange={(e) => setSelectedFilters({...selectedFilters, telehealth: e.target.value})}
              className="px-4 py-2 border rounded-lg text-sm"
            >
              <option value="all">Telehealth</option>
              <option value="available">Telehealth Available</option>
              <option value="only">Telehealth Only</option>
            </select>

            <select
              value={selectedFilters.gender}
              onChange={(e) => setSelectedFilters({...selectedFilters, gender: e.target.value})}
              className="px-4 py-2 border rounded-lg text-sm"
            >
              <option value="all">Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>

            <select
              value={selectedFilters.openingHours}
              onChange={(e) => setSelectedFilters({...selectedFilters, openingHours: e.target.value})}
              className="px-4 py-2 border rounded-lg text-sm"
            >
              <option value="all">Opening Hours</option>
              <option value="now">Open Now</option>
              <option value="weekends">Open Weekends</option>
              <option value="evenings">Open Evenings</option>
            </select>

            <select
              value={selectedFilters.bulkBilling}
              onChange={(e) => setSelectedFilters({...selectedFilters, bulkBilling: e.target.value})}
              className="px-4 py-2 border rounded-lg text-sm"
            >
              <option value="all">Bulk Billing</option>
              <option value="yes">Bulk Billing Available</option>
              <option value="no">Private Billing Only</option>
            </select>
          </div>
        </div>

        {/* Practitioner List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-2 text-text-secondary">Loading practitioners...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayPractitioners.map((practitioner) => {
              const name = practitioner.name?.[0];
              const displayName = name?.text || `${name?.given?.join(' ')} ${name?.family}`;
              const specialty = 'General Practice'; // Mock specialty
              const rating = 4.5; // Mock rating
              const reviews = 100; // Mock reviews
              const bulkBilling = true; // Mock bulk billing
              const telehealthAvailable = false; // Mock telehealth

              return (
                <Card key={practitioner.id} className="hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div className="flex space-x-4">
                      <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center">
                        <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold mb-1">{displayName}</h3>
                        <p className="text-text-secondary mb-2">{specialty}</p>
                        
                        <p className="text-sm text-text-secondary mb-2">
                          123 Healthcare Ave, Brisbane QLD 4000
                        </p>
                        
                        <div className="flex items-center space-x-4 mb-3">
                          <div className="flex items-center">
                            <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            <span className="ml-1 text-sm font-semibold">{rating}</span>
                            <span className="ml-1 text-sm text-text-secondary">({reviews} reviews)</span>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                          {bulkBilling && (
                            <Badge variant="success" size="sm">Bulk Billing</Badge>
                          )}
                          {telehealthAvailable && (
                            <Badge variant="info" size="sm">Telehealth Available</Badge>
                          )}
                        </div>
                        
                        <div className="mt-4">
                          <p className="text-sm text-text-secondary mb-2">Next available appointments:</p>
                          <div className="flex space-x-2">
                            <button className="px-3 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200">
                              9:00 AM
                            </button>
                            <button className="px-3 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200">
                              10:30 AM
                            </button>
                            <button className="px-3 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200">
                              2:15 PM
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <Button
                      variant="primary"
                      onClick={() => handleBookNow(practitioner)}
                    >
                      Book Now
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}