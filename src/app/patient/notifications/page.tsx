import { getSessionFromHeaders, prepareToken } from '@/app/api/fhir/utils/auth';
import { Layout } from '@/components/common/Layout';
import { searchCommunications } from '@/app/api/fhir/communications/operations';
import NotificationsClient from './NotificationsClient';
import { FHIRClient } from '@/app/api/fhir/client';

// Extract patient name from FHIR Patient resource
function extractPatientName(patient: any): string {
  if (!patient?.name?.[0]) return 'Patient';
  
  const name = patient.name[0];
  const given = Array.isArray(name.given) ? name.given.join(' ') : name.given || '';
  const family = name.family || '';
  
  return `${given} ${family}`.trim() || 'Patient';
}

export default async function PatientNotifications() {
  try {
    // Get session from middleware headers
    const session = await getSessionFromHeaders();
    const token = prepareToken(session.accessToken);
    
    // Get patient information
    let patient = null;
    let patientName = 'Patient';
    
    if (session.patient) {
      try {
        const patientResponse = await FHIRClient.fetchWithAuth(
          `${session.fhirBaseUrl}/Patient/${session.patient}`,
          token
        );
        
        if (patientResponse.ok) {
          patient = await patientResponse.json();
          patientName = extractPatientName(patient);
        }
      } catch (error) {
        console.error('Error fetching patient data:', error);
      }
    }
    
    // Fetch patient's communications
    let communications = [];
    try {
      const userRef = `Patient/${session.patient}`;
      
      // Search for communications where patient is recipient
      const receivedResult = await searchCommunications(token, session.fhirBaseUrl, {
        recipient: userRef,
        _count: 100,
        _sort: '-sent'
      });
      
      // Search for communications where patient is sender
      const sentResult = await searchCommunications(token, session.fhirBaseUrl, {
        sender: userRef,
        _count: 100,
        _sort: '-sent'
      });
      
      // Merge and deduplicate results
      const allCommunications = [
        ...(receivedResult.entry || []),
        ...(sentResult.entry || [])
      ];
      
      // Remove duplicates and sort by sent date
      communications = allCommunications
        .filter((comm, index, arr) => 
          arr.findIndex(c => c.resource.id === comm.resource.id) === index
        )
        .sort((a, b) => new Date(b.resource.sent || 0).getTime() - new Date(a.resource.sent || 0).getTime())
        .map(entry => entry.resource);
        
    } catch (error) {
      console.error('Error fetching communications:', error);
    }
    
    return (
      <Layout patientName={patientName}>
        <NotificationsClient 
          patient={patient}
          communications={communications}
          patientName={patientName}
        />
      </Layout>
    );
    
  } catch (error) {
    console.error('Error in patient notifications page:', error);
    
    return (
      <Layout patientName="Patient">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Error Loading Notifications</h1>
            <p className="text-text-secondary">
              There was an error loading your notifications. Please try again later.
            </p>
          </div>
        </div>
      </Layout>
    );
  }
}