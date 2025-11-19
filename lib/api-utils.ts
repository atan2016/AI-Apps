/**
 * Get the API path, accounting for basePath in production
 * In Next.js with basePath, API routes are automatically prefixed,
 * but we need to ensure the path works correctly
 */
export function getApiPath(path: string): string {
  // In client-side code, we can use window.location to detect basePath
  if (typeof window !== 'undefined') {
    // Check if we're in a subdirectory by looking at the pathname
    const pathname = window.location.pathname;
    
    // If pathname starts with /imageEnhancer, we're in production with basePath
    if (pathname.startsWith('/imageEnhancer')) {
      // Remove leading slash from path if present, then prepend basePath
      const cleanPath = path.startsWith('/') ? path.slice(1) : path;
      return `/imageEnhancer/${cleanPath}`;
    }
  }
  
  // Default: return path as-is (works for dev and production without basePath)
  return path;
}

