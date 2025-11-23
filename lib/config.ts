/**
 * Get the number of free credits/images for new users
 * Can be configured via NEXT_PUBLIC_FREE_CREDITS environment variable
 * Default: 5
 */
export function getFreeCredits(): number {
  // Client-side: use NEXT_PUBLIC_ prefix
  if (typeof window !== 'undefined') {
    const clientValue = process.env.NEXT_PUBLIC_FREE_CREDITS;
    if (clientValue) {
      const parsed = parseInt(clientValue, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }
  
  // Server-side: can use either NEXT_PUBLIC_ or FREE_CREDITS
  const serverValue = process.env.FREE_CREDITS || process.env.NEXT_PUBLIC_FREE_CREDITS;
  if (serverValue) {
    const parsed = parseInt(serverValue, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  
  // Default: 5
  return 5;
}

