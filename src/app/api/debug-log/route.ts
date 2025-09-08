import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log(`🔥 [DEBUG-${body.type?.toUpperCase()}]`, JSON.stringify(body.data, null, 2));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Debug log error:', error);
    return NextResponse.json({ error: 'Failed to log' }, { status: 500 });
  }
}