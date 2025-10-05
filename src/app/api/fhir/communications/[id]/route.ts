import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies, prepareToken } from '../../utils/auth';
import {
  getCommunication,
  updateCommunication,
  markCommunicationAsRead,
  deleteCommunication
} from '../operations';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/fhir/communications/[id] - Get communication by ID
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;
  
  try {
    const session = await getSessionFromCookies();
    const token = prepareToken(session.accessToken);
    
    const result = await getCommunication(token, session.fhirBaseUrl, id);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error(`Error in GET /api/fhir/communications/${id}:`, error);
    
    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    if (error instanceof Error && error.message.includes('404')) {
      return NextResponse.json({ error: 'Communication not found' }, { status: 404 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to get communication',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/fhir/communications/[id] - Update communication (mark as read/unread)
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;

  try {
    const session = await getSessionFromCookies();
    const token = prepareToken(session.accessToken);

    const body = await request.json();
    const { action, ...updateData } = body;

    // Determine user reference based on role
    const userRef = session.role === 'patient'
      ? `Patient/${session.patient}`
      : `Practitioner/${session.fhirUser || session.patient}`;

    let result;

    if (action === 'mark-read') {
      // Mark communication as read
      result = await markCommunicationAsRead(
        token,
        session.fhirBaseUrl,
        id,
        userRef
      );
    } else {
      // General update
      const existingCommunication = await getCommunication(token, session.fhirBaseUrl, id);

      // Merge updates
      const updatedCommunication = {
        ...existingCommunication,
        ...updateData
      };

      result = await updateCommunication(
        token,
        session.fhirBaseUrl,
        id,
        updatedCommunication
      );
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error(`Error in PATCH /api/fhir/communications/${id}:`, error);

    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof Error && error.message.includes('404')) {
      return NextResponse.json({ error: 'Communication not found' }, { status: 404 });
    }

    return NextResponse.json(
      {
        error: 'Failed to update communication',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/fhir/communications/[id] - Delete communication
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;

  try {
    const session = await getSessionFromCookies();
    const token = prepareToken(session.accessToken);

    // Delete the communication from FHIR
    await deleteCommunication(token, session.fhirBaseUrl, id);

    return NextResponse.json({ success: true, message: 'Communication deleted successfully' });

  } catch (error) {
    console.error(`Error in DELETE /api/fhir/communications/${id}:`, error);

    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof Error && error.message.includes('404')) {
      return NextResponse.json({ error: 'Communication not found' }, { status: 404 });
    }

    return NextResponse.json(
      {
        error: 'Failed to delete communication',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}