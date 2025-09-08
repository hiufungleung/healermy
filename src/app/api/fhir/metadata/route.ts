import { NextResponse } from 'next/server';

export async function GET() {
  if (!process.env.NEXT_PUBLIC_BASE_URL) {
    throw new Error('Missing required environment variable: NEXT_PUBLIC_BASE_URL');
  }
  
  // Get all available scopes from environment variables
  const patientScopesOnline = process.env.PATIENT_SCOPE_ONLINE?.split(' ') || [];
  const patientScopesOffline = process.env.PATIENT_SCOPE_OFFLINE?.split(' ') || [];
  const providerScopesOnline = process.env.PROVIDER_SCOPE_ONLINE?.split(' ') || [];
  const providerScopesOffline = process.env.PROVIDER_SCOPE_OFFLINE?.split(' ') || [];
  
  // Combine all unique scopes
  const allScopes = Array.from(new Set([
    ...patientScopesOnline,
    ...patientScopesOffline,
    ...providerScopesOnline,
    ...providerScopesOffline
  ]));
  
  // Extract resource types and interactions from scopes
  const resourceCapabilities = new Map();
  
  allScopes.forEach(scope => {
    // Match patterns like "patient/Patient.read", "user/Appointment.write", etc.
    const match = scope.match(/^(patient|user)\/(\w+)\.(read|write|search)$/);
    if (match) {
      const [, , resourceType, operation] = match;
      
      if (!resourceCapabilities.has(resourceType)) {
        resourceCapabilities.set(resourceType, new Set());
      }
      
      // Map scope operations to FHIR interaction codes
      const interactions = resourceCapabilities.get(resourceType);
      if (operation === 'read') {
        interactions.add('read');
      } else if (operation === 'write') {
        interactions.add('create');
        interactions.add('update');
      } else if (operation === 'search') {
        interactions.add('search-type');
      }
    }
  });
  
  // Convert to FHIR CapabilityStatement resource format
  const resources = Array.from(resourceCapabilities.entries()).map(([resourceType, interactions]) => ({
    type: resourceType,
    interaction: Array.from(interactions).map(code => ({ code }))
  }));
  
  const metadata = {
    resourceType: 'CapabilityStatement',
    status: 'active',
    date: new Date().toISOString(),
    publisher: 'HealerMy Mock FHIR Server',
    kind: 'instance',
    software: {
      name: 'HealerMy FHIR Server',
      version: '1.0.0'
    },
    fhirVersion: '4.0.1',
    format: ['json'],
    rest: [{
      mode: 'server',
      security: {
        extension: [{
          url: 'http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris',
          extension: [{
            url: 'authorize',
            valueUri: `${process.env.NEXT_PUBLIC_CERNER_AUTH_BASE_URL}/patient/authorize`
          }, {
            url: 'token',
            valueUri: `${process.env.NEXT_PUBLIC_CERNER_AUTH_BASE_URL}/patient/token`
          }]
        }],
        service: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/restful-security-service',
            code: 'SMART-on-FHIR'
          }]
        }]
      },
      resource: resources
    }]
  };

  return NextResponse.json(metadata);
}