'use client';

import React, { useState } from 'react';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';

interface CreatePractitionerFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface PractitionerFormData {
  // Name
  prefix: string;
  given: string;
  family: string;
  suffix: string;
  
  // Contact
  phone: string;
  email: string;
  
  // Address
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  
  // Professional Info
  gender: string;
  
  // Status
  active: boolean;
}


export function CreatePractitionerForm({ isOpen, onClose, onSuccess }: CreatePractitionerFormProps) {
  const [formData, setFormData] = useState<PractitionerFormData>({
    prefix: '',
    given: '',
    family: '',
    suffix: '',
    phone: '',
    email: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    gender: '',
    active: true,
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: keyof PractitionerFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };


  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Required fields
    if (!formData.given.trim()) {
      newErrors.given = 'Given name is required';
    }
    if (!formData.family.trim()) {
      newErrors.family = 'Family name is required';
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    // Address validation
    if (!formData.addressLine1.trim()) {
      newErrors.addressLine1 = 'Street address is required';
    }
    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
    }
    if (!formData.postalCode.trim()) {
      newErrors.postalCode = 'Postal code is required';
    }
    
    // Professional info
    if (!formData.gender) {
      newErrors.gender = 'Gender is required';
    }
    
    // Validate phone format (basic)
    if (formData.phone && !/^[\+]?[0-9\s\-\(\)]+$/.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    
    try {
      // Construct FHIR Practitioner resource with address
      const practitionerResource = {
        resourceType: 'Practitioner',
        active: formData.active,
        name: [
          {
            use: 'official',
            prefix: formData.prefix ? [formData.prefix] : undefined,
            given: [formData.given],
            family: formData.family,
            suffix: formData.suffix ? [formData.suffix] : undefined,
            text: `${formData.prefix} ${formData.given} ${formData.family} ${formData.suffix}`.trim().replace(/\s+/g, ' ')
          }
        ],
        telecom: [
          {
            system: 'phone',
            value: formData.phone,
            use: 'work'
          },
          {
            system: 'email',
            value: formData.email,
            use: 'work'
          }
        ].filter(t => t.value),
        address: [
          {
            use: 'work',
            type: 'physical',
            line: [formData.addressLine1, formData.addressLine2].filter(Boolean),
            city: formData.city,
            state: formData.state,
            postalCode: formData.postalCode,
            country: formData.country,
            text: `${formData.addressLine1}${formData.addressLine2 ? ', ' + formData.addressLine2 : ''}, ${formData.city}${formData.state ? ', ' + formData.state : ''}${formData.postalCode ? ' ' + formData.postalCode : ''}${formData.country ? ', ' + formData.country : ''}`
          }
        ],
        gender: formData.gender as 'male' | 'female' | 'other' | 'unknown',
        identifier: [
          {
            use: 'official',
            type: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                  code: 'PRN',
                  display: 'Provider number'
                }
              ]
            },
            system: process.env.NEXT_PUBLIC_PRACTITIONER_IDENTIFIER_SYSTEM!,
            value: `PROV-${Date.now()}`
          }
        ],
      };

      console.log('Creating practitioner with data:', practitionerResource);

      const response = await fetch('/api/fhir/practitioners', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(practitionerResource),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to create practitioner: ${response.status} - ${errorData}`);
      }

      const result = await response.json();
      console.log('Practitioner created successfully:', result);
      
      onSuccess();
      onClose();
      
      // Reset form
      setFormData({
        prefix: '',
        given: '',
        family: '',
        suffix: '',
        phone: '',
        email: '',
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
        gender: '',
        active: true,
      });
      
    } catch (error) {
      console.error('Error creating practitioner:', error);
      setErrors({ submit: error instanceof Error ? error.message : 'An unexpected error occurred' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-text-primary">Create New Practitioner</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={loading}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Personal Information */}
          <Card>
            <h3 className="text-lg font-semibold text-text-primary mb-4">Personal Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Prefix
                </label>
                <select
                  value={formData.prefix}
                  onChange={(e) => handleInputChange('prefix', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select...</option>
                  <option value="Dr">Dr</option>
                  <option value="Prof">Prof</option>
                  <option value="Mr">Mr</option>
                  <option value="Ms">Ms</option>
                  <option value="Mrs">Mrs</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Given Name *
                </label>
                <input
                  type="text"
                  value={formData.given}
                  onChange={(e) => handleInputChange('given', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.given ? 'border-red-500' : ''
                  }`}
                  placeholder="First name"
                />
                {errors.given && <p className="text-red-500 text-xs mt-1">{errors.given}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Family Name *
                </label>
                <input
                  type="text"
                  value={formData.family}
                  onChange={(e) => handleInputChange('family', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.family ? 'border-red-500' : ''
                  }`}
                  placeholder="Last name"
                />
                {errors.family && <p className="text-red-500 text-xs mt-1">{errors.family}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Suffix
                </label>
                <input
                  type="text"
                  value={formData.suffix}
                  onChange={(e) => handleInputChange('suffix', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Jr, Sr, III, etc."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Gender *
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => handleInputChange('gender', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.gender ? 'border-red-500' : ''
                  }`}
                >
                  <option value="">Select gender...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="unknown">Unknown</option>
                </select>
                {errors.gender && <p className="text-red-500 text-xs mt-1">{errors.gender}</p>}
              </div>
            </div>
          </Card>

          {/* Contact Information */}
          <Card>
            <h3 className="text-lg font-semibold text-text-primary mb-4">Contact Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.phone ? 'border-red-500' : ''
                  }`}
                  placeholder="+61 400 123 456"
                />
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.email ? 'border-red-500' : ''
                  }`}
                  placeholder="doctor@clinic.com.au"
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>
            </div>
          </Card>

          {/* Address Information */}
          <Card>
            <h3 className="text-lg font-semibold text-text-primary mb-4">Address Information</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Street Address Line 1 *
                </label>
                <input
                  type="text"
                  value={formData.addressLine1}
                  onChange={(e) => handleInputChange('addressLine1', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.addressLine1 ? 'border-red-500' : ''
                  }`}
                  placeholder="44 High Street"
                />
                {errors.addressLine1 && <p className="text-red-500 text-xs mt-1">{errors.addressLine1}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Street Address Line 2
                </label>
                <input
                  type="text"
                  value={formData.addressLine2}
                  onChange={(e) => handleInputChange('addressLine2', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Unit 999"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    City *
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                      errors.city ? 'border-red-500' : ''
                    }`}
                    placeholder="City name"
                  />
                  {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    State/Province
                  </label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => handleInputChange('state', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="State or province"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Postal Code *
                  </label>
                  <input
                    type="text"
                    value={formData.postalCode}
                    onChange={(e) => handleInputChange('postalCode', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                      errors.postalCode ? 'border-red-500' : ''
                    }`}
                    placeholder="Postal/ZIP code"
                  />
                  {errors.postalCode && <p className="text-red-500 text-xs mt-1">{errors.postalCode}</p>}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Country
                  </label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => handleInputChange('country', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Country code (e.g., US, AU, CA)"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Professional Information */}
          <Card>
            <h3 className="text-lg font-semibold text-text-primary mb-4">Professional Information</h3>
            
            <div className="flex items-center">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => handleInputChange('active', e.target.checked)}
                  className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary focus:ring-2"
                />
                <span className="ml-2 text-sm font-medium text-text-secondary">
                  Active practitioner
                </span>
              </label>
            </div>
          </Card>

          {/* Submit Error */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600 text-sm">{errors.submit}</p>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="primary"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Practitioner'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}