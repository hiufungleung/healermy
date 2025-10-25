import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies, validateRole, prepareToken } from '../../utils/auth';
import { getSchedule, updateSchedule, patchSchedule, deleteSchedule } from '../operations';

/**
 * GET /api/fhir/Schedule/[id] - Get schedule by ID
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    // Extract session from middleware headers
    const session = await getSessionFromCookies();

    // Validate that user has provider role
    validateRole(session, 'provider');

    const token = prepareToken(session.accessToken);
    const result = await getSchedule(token, session.fhirBaseUrl, id);

    return NextResponse.json(result);
  } catch (error) {
    console.error(`Error in GET /api/fhir/Schedule/${id}:`, error);
    
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
 * PUT /api/fhir/Schedule/[id] - Update schedule by ID
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    // Extract session from middleware headers
    const session = await getSessionFromCookies();

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
    scheduleData.id = id;

    const token = prepareToken(session.accessToken);
    const result = await updateSchedule(token, session.fhirBaseUrl, id, scheduleData);

    return NextResponse.json(result);
  } catch (error) {
    console.error(`Error in PUT /api/fhir/Schedule/${id}:`, error);
    
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
 * PATCH /api/fhir/Schedule/[id] - Patch schedule with JSON Patch operations
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    // Extract session from middleware headers
    const session = await getSessionFromCookies();

    // Validate that user has provider role
    if (session.role !== 'provider') {
      return NextResponse.json(
        { error: 'Forbidden: Only providers can patch schedules' },
        { status: 403 }
      );
    }

    const patchOperations = await request.json();

    // Validate patch operations format
    if (!Array.isArray(patchOperations)) {
      return NextResponse.json(
        { error: 'Invalid patch operations: must be an array' },
        { status: 400 }
      );
    }

    const token = prepareToken(session.accessToken);
    const result = await patchSchedule(token, session.fhirBaseUrl, id, patchOperations);

    return NextResponse.json(result);
  } catch (error) {
    console.error(`Error in PATCH /api/fhir/Schedule/${id}:`, error);

    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof Error && error.message.includes('404')) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    return NextResponse.json(
      {
        error: 'Failed to patch schedule',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/fhir/Schedule/[id] - Delete schedule by ID
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    // Extract session from middleware headers
    const session = await getSessionFromCookies();

    // Validate that user has provider role
    validateRole(session, 'provider');

    const token = prepareToken(session.accessToken);
    const result = await deleteSchedule(token, session.fhirBaseUrl, id);

    return NextResponse.json(result);
  } catch (error) {
    console.error(`Error in DELETE /api/fhir/Schedule/${id}:`, error);

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