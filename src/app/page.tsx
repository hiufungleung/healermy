import HomeClient from './HomeClient';

// Force dynamic rendering to read runtime environment variables
export const dynamic = 'force-dynamic';

export default function Home() {
  // Server Component: Read FHIR_SERVER_URL securely from server-side
  // Note: Authentication check is now handled in middleware.ts
  // Logged-in users are redirected server-side before this component renders

  const fhirServerUrl = process.env.FHIR_SERVER_URL || process.env.NEXT_PUBLIC_FHIR_SERVER_URL || null;

  return <HomeClient fhirServerUrl={fhirServerUrl} />;
}