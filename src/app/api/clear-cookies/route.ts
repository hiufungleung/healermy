import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'All cookies cleared' });
  
  // Clear all auth-related cookies
  const cookiesToClear = [
    'auth_session',
    'auth_access_token',
    'auth_refresh_token',
    'auth_token_url',
    'auth_expires_at',
    'auth_patient_id',
    'auth_fhir_base_url',
    'auth_user_role'
  ];
  
  cookiesToClear.forEach(cookieName => {
    response.cookies.set(cookieName, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/'
    });
  });
  
  return response;
}