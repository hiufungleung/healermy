import { NextRequest, NextResponse } from 'next/server';
import { AuthSession } from '@/types/auth';
import { encrypt } from '@/library/auth/encryption';
import { SESSION_COOKIE_NAME } from '@/library/auth/config';

export async function POST(request: NextRequest) {
  try {
    const sessionData: AuthSession = await request.json();
    
    console.log('📝 Creating session for role:', sessionData.role);
    
    // Encrypt entire session object
    const encryptedSessionString = await encrypt(JSON.stringify(sessionData));
    
    // Create secure HTTP-only cookie with fully encrypted data
    const response = NextResponse.json({ success: true });
    
    response.cookies.set(SESSION_COOKIE_NAME, encryptedSessionString, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: sessionData.expiresAt ? Math.floor((sessionData.expiresAt - Date.now()) / 1000) : 7 * 24 * 60 * 60, // 7 days default
      path: '/',
    });

    console.log('✅ Session created successfully with encrypted sensitive data');
    return response;

  } catch (error) {
    console.error('❌ Session creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}