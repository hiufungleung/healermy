import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromHeaders, prepareToken } from '../utils/auth';
import { 
  searchCommunications, 
  createCommunication,
  createManualMessage,
  getUnreadCommunicationsCount
} from './operations';

/**
 * GET /api/fhir/communications - Search communications
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromHeaders();
    const token = prepareToken(session.accessToken);
    
    const { searchParams } = new URL(request.url);
    const appointmentId = searchParams.get('about');
    const unreadOnly = searchParams.get('unread') === 'true';
    const count = parseInt(searchParams.get('_count') || '50');
    
    // Determine user reference based on role
    const userRef = session.role === 'patient' 
      ? `Patient/${session.patient}` 
      : `Practitioner/${session.fhirUser || session.patient}`;
    
    if (unreadOnly) {
      // Return unread count
      const unreadCount = await getUnreadCommunicationsCount(
        token,
        session.fhirBaseUrl,
        userRef
      );
      
      return NextResponse.json({ 
        total: unreadCount,
        unread: true 
      });
    }
    
    // Search parameters - user can be either recipient or sender
    const searchOptions: any = {
      _count: count,
      _sort: '-sent'
    };
    
    // Add appointment filter if specified
    if (appointmentId) {
      searchOptions.about = `Appointment/${appointmentId}`;
    }
    
    // Get communications where user is recipient
    const result = await searchCommunications(token, session.fhirBaseUrl, {
      ...searchOptions,
      recipient: userRef
    });
    
    // Also get communications where user is sender
    const sentResult = await searchCommunications(token, session.fhirBaseUrl, {
      ...searchOptions,
      sender: userRef
    });
    
    // Merge and deduplicate results
    const allCommunications = [
      ...(result.entry || []),
      ...(sentResult.entry || [])
    ];
    
    // Remove duplicates and sort by sent date
    const uniqueCommunications = allCommunications
      .filter((comm, index, arr) => 
        arr.findIndex(c => c.resource.id === comm.resource.id) === index
      )
      .sort((a, b) => new Date(b.resource.sent || 0).getTime() - new Date(a.resource.sent || 0).getTime());
    
    return NextResponse.json({
      resourceType: 'Bundle',
      type: 'searchset',
      total: uniqueCommunications.length,
      entry: uniqueCommunications
    });
    
  } catch (error) {
    console.error('Error in GET /api/fhir/communications:', error);
    
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
 * POST /api/fhir/communications - Create communication
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromHeaders();
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
      : `Practitioner/${session.fhirUser || session.patient}`;
    
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
      const communicationData = {
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
    console.error('Error in POST /api/fhir/communications:', error);
    
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