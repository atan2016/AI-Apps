import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Skip authentication flag (works in both dev and production)
const SKIP_AUTH = process.env.SKIP_AUTH === 'true';

// Whitelist IP addresses (your IP for testing in production)
const WHITELISTED_IPS = (process.env.WHITELISTED_IPS || '').split(',').map(ip => ip.trim()).filter(Boolean);

// Get base path from environment (for subdirectory deployment)
const BASE_PATH = process.env.USE_SUBDIRECTORY === 'true' ? '/imageEnhancer' : '';

// Define public routes (no auth required)
const isPublicRoute = createRouteMatcher([
  '/',
  `${BASE_PATH}/`,
  '/info(.*)',
  `${BASE_PATH}/info(.*)`,
  '/api/generate(.*)',
  `${BASE_PATH}/api/generate(.*)`,
  '/api/stripe/webhook(.*)',
  `${BASE_PATH}/api/stripe/webhook(.*)`,
  '/sign-in(.*)',
  `${BASE_PATH}/sign-in(.*)`,
  '/sign-up(.*)',
  `${BASE_PATH}/sign-up(.*)`,
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
    // Always run for API routes (with or without basePath)
    '/(api|trpc)(.*)',
    '/imageEnhancer/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/imageEnhancer/(api|trpc)(.*)',
  ],
};

