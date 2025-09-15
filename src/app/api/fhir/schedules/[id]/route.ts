import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromHeaders, validateRole, prepareToken } from '../../utils/auth';
import { getSchedule, updateSchedule, deleteSchedule } from '../operations';

/**
 * GET /api/fhir/schedules/[id] - Get schedule by ID
 */
export async function GET(
  request: NextRequest, 
  { params }: { params: { id: string } }
) {
  try {
    // Extract session from middleware headers
    const session = await getSessionFromHeaders();
    
    // Validate that user has provider role
    validateRole(session, 'provider');
    
    const token = prepareToken(session.accessToken);
    const result = await getSchedule(token, session.fhirBaseUrl, params.id);

    return NextResponse.json(result);
  } catch (error) {
    console.error(`Error in GET /api/fhir/schedules/${params?.id}:`, error);
    
    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    if (error instanceof Error && error.message.includes('404')) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to get schedule',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/fhir/schedules/[id] - Update schedule by ID
 */
export async function PUT(
  request: NextRequest, 
  { params }: { params: { id: string } }
) {
  try {
    // Extract session from middleware headers
    const session = await getSessionFromHeaders();
    
    // Validate that user has provider role
    validateRole(session, 'provider');
    
    const scheduleData = await request.json();
    
    // Basic validation
    if (!scheduleData.resourceType || scheduleData.resourceType !== 'Schedule') {
      return NextResponse.json(
        { error: 'Invalid schedule data: resourceType must be "Schedule"' },
        { status: 400 }
      );
    }
    
    // Ensure the ID in the data matches the URL parameter
    scheduleData.id = params.id;
    
    const token = prepareToken(session.accessToken);
    const result = await updateSchedule(token, session.fhirBaseUrl, params.id, scheduleData);

    return NextResponse.json(result);
  } catch (error) {
    console.error(`Error in PUT /api/fhir/schedules/${params?.id}:`, error);
    
    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    if (error instanceof Error && error.message.includes('404')) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to update schedule',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/fhir/schedules/[id] - Delete schedule by ID
 */
export async function DELETE(
  request: NextRequest, 
  { params }: { params: { id: string } }
) {
  try {
    // Extract session from middleware headers
    const session = await getSessionFromHeaders();
    
    // Validate that user has provider role
    validateRole(session, 'provider');
    
    const token = prepareToken(session.accessToken);
    const result = await deleteSchedule(token, session.fhirBaseUrl, params.id);

    return NextResponse.json(result);
  } catch (error) {
    console.error(`Error in DELETE /api/fhir/schedules/${params?.id}:`, error);
    
    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    if (error instanceof Error && error.message.includes('404')) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to delete schedule',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}