'use client';

import React, { useState } from 'react';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

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
            system: 'urn:ietf:rfc:3986',
            value: `urn:uuid:${crypto.randomUUID()}`
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Practitioner</DialogTitle>
          <DialogDescription>
            Fill in the practitioner information below. Fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information */}
          <Card>
            <h3 className="text-sm sm:text-base md:text-lg font-semibold text-text-primary mb-4">Personal Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="prefix">Prefix</Label>
                <Select
                  value={formData.prefix}
                  onValueChange={(value) => handleInputChange('prefix', value)}
                >
                  <SelectTrigger id="prefix">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dr">Dr</SelectItem>
                    <SelectItem value="Prof">Prof</SelectItem>
                    <SelectItem value="Mr">Mr</SelectItem>
                    <SelectItem value="Ms">Ms</SelectItem>
                    <SelectItem value="Mrs">Mrs</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="given">Given Name *</Label>
                <Input
                  id="given"
                  type="text"
                  value={formData.given}
                  onChange={(e) => handleInputChange('given', e.target.value)}
                  placeholder="First name"
                  className={errors.given ? 'border-red-500' : ''}
                />
                {errors.given && <p className="text-red-500 text-xs">{errors.given}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="family">Family Name *</Label>
                <Input
                  id="family"
                  type="text"
                  value={formData.family}
                  onChange={(e) => handleInputChange('family', e.target.value)}
                  placeholder="Last name"
                  className={errors.family ? 'border-red-500' : ''}
                />
                {errors.family && <p className="text-red-500 text-xs">{errors.family}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="suffix">Suffix</Label>
                <Input
                  id="suffix"
                  type="text"
                  value={formData.suffix}
                  onChange={(e) => handleInputChange('suffix', e.target.value)}
                  placeholder="Jr, Sr, III, etc."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gender">Gender *</Label>
                <Select
                  value={formData.gender}
                  onValueChange={(value) => handleInputChange('gender', value)}
                >
                  <SelectTrigger id="gender" className={errors.gender ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select gender..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
                {errors.gender && <p className="text-red-500 text-xs">{errors.gender}</p>}
              </div>
            </div>
          </Card>

          {/* Contact Information */}
          <Card>
            <h3 className="text-sm sm:text-base md:text-lg font-semibold text-text-primary mb-4">Contact Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="+61 400 123 456"
                  className={errors.phone ? 'border-red-500' : ''}
                />
                {errors.phone && <p className="text-red-500 text-xs">{errors.phone}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="doctor@clinic.com.au"
                  className={errors.email ? 'border-red-500' : ''}
                />
                {errors.email && <p className="text-red-500 text-xs">{errors.email}</p>}
              </div>
            </div>
          </Card>

          {/* Address Information */}
          <Card>
            <h3 className="text-sm sm:text-base md:text-lg font-semibold text-text-primary mb-4">Address Information</h3>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="addressLine1">Street Address Line 1 *</Label>
                <Input
                  id="addressLine1"
                  type="text"
                  value={formData.addressLine1}
                  onChange={(e) => handleInputChange('addressLine1', e.target.value)}
                  placeholder="44 High Street"
                  className={errors.addressLine1 ? 'border-red-500' : ''}
                />
                {errors.addressLine1 && <p className="text-red-500 text-xs">{errors.addressLine1}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="addressLine2">Street Address Line 2</Label>
                <Input
                  id="addressLine2"
                  type="text"
                  value={formData.addressLine2}
                  onChange={(e) => handleInputChange('addressLine2', e.target.value)}
                  placeholder="Unit 999"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    type="text"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    placeholder="City name"
                    className={errors.city ? 'border-red-500' : ''}
                  />
                  {errors.city && <p className="text-red-500 text-xs">{errors.city}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">State/Province</Label>
                  <Input
                    id="state"
                    type="text"
                    value={formData.state}
                    onChange={(e) => handleInputChange('state', e.target.value)}
                    placeholder="State or province"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="postalCode">Postal Code *</Label>
                  <Input
                    id="postalCode"
                    type="text"
                    value={formData.postalCode}
                    onChange={(e) => handleInputChange('postalCode', e.target.value)}
                    placeholder="Postal/ZIP code"
                    className={errors.postalCode ? 'border-red-500' : ''}
                  />
                  {errors.postalCode && <p className="text-red-500 text-xs">{errors.postalCode}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    type="text"
                    value={formData.country}
                    onChange={(e) => handleInputChange('country', e.target.value)}
                    placeholder="Country code (e.g., US, AU, CA)"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Professional Information */}
          <Card>
            <h3 className="text-sm sm:text-base md:text-lg font-semibold text-text-primary mb-4">Professional Information</h3>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => handleInputChange('active', checked as boolean)}
              />
              <Label
                htmlFor="active"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Active practitioner
              </Label>
            </div>
          </Card>

          {/* Submit Error */}
          {errors.submit && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errors.submit}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
