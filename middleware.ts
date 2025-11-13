import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Skip authentication flag (works in both dev and production)
const SKIP_AUTH = process.env.SKIP_AUTH === 'true';

// Whitelist IP addresses (your IP for testing in production)
const WHITELISTED_IPS = (process.env.WHITELISTED_IPS || '').split(',').map(ip => ip.trim()).filter(Boolean);

// Define public routes (no auth required)
const isPublicRoute = createRouteMatcher([
  '/',
  '/api/generate(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
]);

// Helper function to get client IP
function getClientIP(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIP = req.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (realIP) {
    return realIP;
  }
  return null;
}

export default clerkMiddleware(async (auth, req) => {
  // Skip auth if SKIP_AUTH flag is set
  if (SKIP_AUTH) {
    return NextResponse.next();
  }

  // Skip auth for whitelisted IP addresses
  const clientIP = getClientIP(req);
  if (clientIP && WHITELISTED_IPS.includes(clientIP)) {
    console.log(`✅ Whitelisted IP detected: ${clientIP} - skipping auth`);
    return NextResponse.next();
  }

  // Protect all routes except public ones
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};

