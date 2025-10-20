import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { TOKEN_COOKIE_NAME } from '@/library/auth/config';

export async function POST() {
  try {
    // Token revocation is now handled client-side with session URLs

    // Always clear session cookie
    const response = NextResponse.json({ success: true, message: 'Logged out successfully' });

    const cookieClearOptions = {
      path: '/',
      maxAge: 0,
      sameSite: 'strict' as const,
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true
    };

    response.cookies.set(TOKEN_COOKIE_NAME, '', cookieClearOptions);

    return response;

  } catch (error) {
    console.error('Logout error:', error);

    // Even if logout fails, clear cookie
    const response = NextResponse.json(
      { success: false, error: 'Logout failed but cookies cleared' },
      { status: 500 }
    );

    const cookieClearOptions = {
      path: '/',
      maxAge: 0,
      sameSite: 'strict' as const,
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true
    };

    response.cookies.set(TOKEN_COOKIE_NAME, '', cookieClearOptions);

    return response;
  }
}