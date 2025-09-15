// Comprehensive validation function for practitioner data
export function validatePractitionerData(data: any): string[] {
  const errors: string[] = [];

  // Basic structure validation
  if (!data.resourceType || data.resourceType !== 'Practitioner') {
    errors.push('Invalid resource type. Expected: Practitioner');
  }

  // Name validation
  if (!data.name || !Array.isArray(data.name) || data.name.length === 0) {
    errors.push('Name is required');
  } else {
    const name = data.name[0];
    if (!name.given || !Array.isArray(name.given) || name.given.length === 0 || !name.given[0]) {
      errors.push('Given name is required');
    }
    if (!name.family || typeof name.family !== 'string' || name.family.trim() === '') {
      errors.push('Family name is required');
    }
  }

  // Contact validation
  if (!data.telecom || !Array.isArray(data.telecom)) {
    errors.push('Contact information is required');
  } else {
    const phone = data.telecom.find((t: any) => t.system === 'phone');
    const email = data.telecom.find((t: any) => t.system === 'email');
    
    if (!phone || !phone.value) {
      errors.push('Phone number is required');
    } else if (!/^[\+]?[0-9\s\-\(\)]+$/.test(phone.value)) {
      errors.push('Invalid phone number format');
    }
    
    if (!email || !email.value) {
      errors.push('Email address is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
      errors.push('Invalid email format');
    }
  }

  // Address validation (Australian format)
  if (!data.address || !Array.isArray(data.address) || data.address.length === 0) {
    errors.push('Address is required');
  } else {
    const address = data.address[0];
    if (!address.line || !Array.isArray(address.line) || address.line.length === 0 || !address.line[0]) {
      errors.push('Street address is required');
    }
    if (!address.city || typeof address.city !== 'string' || address.city.trim() === '') {
      errors.push('Suburb is required');
    }
    if (!address.state || typeof address.state !== 'string' || address.state.trim() === '') {
      errors.push('State is required');
    }
    if (!address.postalCode || !/^\d{4}$/.test(address.postalCode)) {
      errors.push('Valid 4-digit postcode is required');
    }
    // SECURITY: Enforce AU country
    if (!address.country || address.country !== 'AU') {
      errors.push('Country must be Australia (AU)');
    }
  }

  // Gender validation
  if (!data.gender || !['male', 'female', 'other', 'unknown'].includes(data.gender)) {
    errors.push('Valid gender is required (male, female, other, unknown)');
  }

  // Active status validation
  if (typeof data.active !== 'boolean') {
    errors.push('Active status must be a boolean');
  }

  // Communication (languages) validation
  if (!data.communication || !Array.isArray(data.communication) || data.communication.length === 0) {
    errors.push('At least one language is required');
  } else {
    for (const comm of data.communication) {
      if (!comm.language || !comm.language.coding || !Array.isArray(comm.language.coding) || comm.language.coding.length === 0) {
        errors.push('Invalid language format');
        break;
      }
      const coding = comm.language.coding[0];
      if (!coding.system || coding.system !== 'urn:ietf:bcp:47' || !coding.code) {
        errors.push('Invalid language coding format');
        break;
      }
    }
  }

  // Identifier validation (ensure our system)
  if (!data.identifier || !Array.isArray(data.identifier) || data.identifier.length === 0) {
    errors.push('Practitioner identifier is required');
  } else {
    const hasValidIdentifier = data.identifier.some((id: any) => 
      id.system && (
        id.system.includes('healermy.com') || 
        id.system === process.env.NEXT_PUBLIC_PRACTITIONER_IDENTIFIER_SYSTEM
      )
    );
    if (!hasValidIdentifier) {
      errors.push('Valid practitioner identifier system is required');
    }
  }

  return errors;
}