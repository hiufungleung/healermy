import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies, prepareToken } from '@/app/api/fhir/utils/auth';
import {
  searchCommunications,
  createCommunication,
  createManualMessage,
  getUnreadCommunicationsCount,
  isCommunicationRead
} from './operations';
import type { Communication } from '@/types/fhir';

/**
 * GET /api/fhir/Communication - Search communications
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    const token = prepareToken(session.accessToken);

    const searchParams = request.nextUrl.searchParams;
    const appointmentId = searchParams.get('about');
    const unreadOnly = searchParams.get('unread') === 'true';
    const count = parseInt(searchParams.get('_count') || '1000'); // Increased default to fetch all communications
    
    // Only providers have clinic-wide view
    // Patients see only their relevant communications
    const isProvider = session.role === 'provider';

    if (unreadOnly) {
      // Return unread count
      let unreadCount = 0;

      if (isProvider) {
        // For providers, get all communications and count unread ones (clinic-wide)
        const allCommunications = await searchCommunications(token, session.fhirBaseUrl, {
          _count: 100,
          _sort: '-sent'
        });

        if (allCommunications.entry) {
          for (const entry of allCommunications.entry) {
            if (!isCommunicationRead(entry.resource)) {
              unreadCount++;
            }
          }
        }
      } else {
        // For patients, get communications where they are recipient
        const patientRef = `Patient/${session.patient}`;
        unreadCount = await getUnreadCommunicationsCount(
          token,
          session.fhirBaseUrl,
          patientRef
        );
      }
      
      return NextResponse.json({ 
        total: unreadCount,
        unread: true 
      });
    }
    
    // Search parameters
    const searchOptions: any = {
      _count: count,
      _sort: '-sent'
    };

    // Add appointment filter if specified
    if (appointmentId) {
      searchOptions.about = `Appointment/${appointmentId}`;
    }

    let allCommunications: any[] = [];

    if (isProvider) {
      // For providers, get all communications (clinic-wide view)
      const result = await searchCommunications(token, session.fhirBaseUrl, searchOptions);
      allCommunications = result.entry || [];

      // Filter out communications marked as deleted by provider
      allCommunications = allCommunications.filter(entry => {
        const comm = entry.resource;
        const deletedExtension = comm.extension?.find((ext: any) =>
          ext.url === 'http://hl7.org/fhir/StructureDefinition/communication-deleted-by-provider'
        );
        return !deletedExtension?.valueBoolean;
      });
    } else {
      // For patients, ONLY get communications where patient is recipient
      // This prevents patients from seeing appointment-request notifications they sent to providers
      const patientRef = `Patient/${session.patient}`;

      const result = await searchCommunications(token, session.fhirBaseUrl, {
        ...searchOptions,
        recipient: patientRef
      });

      allCommunications = result.entry || [];
      // Patients can see all their communications, even if provider deleted them
    }

    // Sort by sent date (newest first)
    const uniqueCommunications = allCommunications
      .sort((a, b) => new Date(b.resource.sent || 0).getTime() - new Date(a.resource.sent || 0).getTime());
    
    return NextResponse.json({
      resourceType: 'Bundle',
      type: 'searchset',
      total: uniqueCommunications.length,
      entry: uniqueCommunications
    });
    
  } catch (error) {
    console.error('Error in GET /api/fhir/Communication:', error);
    
    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to search communications',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fhir/Communication - Create communication
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    const token = prepareToken(session.accessToken);
    
    const body = await request.json();
    const { recipient, message, appointmentId, category = 'manual-message' } = body;
    
    if (!recipient || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: recipient, message' },
        { status: 400 }
      );
    }
    
    // Determine sender reference based on role
    const senderRef = session.role === 'patient'
      ? `Patient/${session.patient}`
      : `Practitioner/${session.practitioner || session.patient}`;
    
    // Determine subject (usually the patient)
    const subjectRef = session.role === 'patient' 
      ? `Patient/${session.patient}`
      : recipient.startsWith('Patient/') ? recipient : `Patient/${session.patient}`;
    
    let result;
    
    if (category === 'manual-message') {
      // Create manual message
      result = await createManualMessage(
        token,
        session.fhirBaseUrl,
        senderRef,
        recipient,
        message,
        appointmentId,
        subjectRef
      );
    } else {
      // Create custom communication
      const communicationData: Partial<Communication> = {
        resourceType: 'Communication',
        status: 'completed',
        category: [{
          text: category
        }],
        subject: { reference: subjectRef },
        about: appointmentId ? [{ reference: `Appointment/${appointmentId}` }] : undefined,
        recipient: [{ reference: recipient }],
        sender: { reference: senderRef },
        sent: new Date().toISOString(),
        payload: [{
          contentString: message
        }]
      };
      
      result = await createCommunication(token, session.fhirBaseUrl, communicationData);
    }
    
    return NextResponse.json(result, { status: 201 });
    
  } catch (error) {
    console.error('Error in POST /api/fhir/Communication:', error);
    
    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to create communication',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}