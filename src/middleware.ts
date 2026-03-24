import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from './lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  // PHASE 3 SAAS ADDITION: License Verification
  // If SaaS mode is true, we intercept and check if the license is valid
  // If not valid, redirect them to the "Subscription Expired" page
  if (process.env.NEXT_PUBLIC_SAAS_MODE === 'true') {
    const isPublicAsset = request.nextUrl.pathname.startsWith('/_next') || request.nextUrl.pathname.startsWith('/auth') || request.nextUrl.pathname === '/license-expired';
    
    if (!isPublicAsset) {
      // Typically, in a true edge middleware you'd fetch the validation route or check a securely signed JWT cookie
      // For this implementation architecture, we pass them through but require the main app layout to validate,
      // OR we can do a lightweight check. Due to Edge Function limitations on `fetch`, we'll pass for now and rely on layout/page checks,
      // or check a cookie if set by the auth flow. 
      // Because this is your single-tenant project, we just add the hook structure safely:
      const saasCookie = request.cookies.get('saas_license_status');
      if (saasCookie?.value === 'invalid') {
        const url = request.nextUrl.clone();
        url.pathname = '/license-expired';
        return NextResponse.redirect(url);
      }
    }
  }

  // Original single-tenant session handling (unaffected)
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
