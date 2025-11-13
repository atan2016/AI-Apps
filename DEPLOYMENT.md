# Deployment Guide

## Local Development

By default, authentication is **disabled** in local development (`SKIP_AUTH=true`) so you can test the app freely without signing in.

Just run:
```bash
npm run dev
```

### Testing Authentication in Development

To test the authentication flow locally:

1. Set `SKIP_AUTH=false` in your `.env` file
2. Add your Clerk keys to `.env`:
   ```bash
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   ```
3. Restart the dev server
4. Authentication will now be required

## IP Whitelisting (Optional)

You can whitelist specific IP addresses to bypass authentication even in production. This is useful for:
- Your own IP for testing in production
- Admin access without signing in
- Development team access

Add to your `.env` or environment variables:
```bash
WHITELISTED_IPS=123.456.789.0,111.222.333.444
```

**How to find your IP address:**
- Visit https://www.whatismyip.com/
- Or run: `curl ifconfig.me`

⚠️ **Security Note:** Keep your IP address private and only whitelist trusted IPs.

## Production Deployment

### 1. Set up Clerk Authentication

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Create a new application
3. Get your API keys from the dashboard
4. Add the following environment variables to your production environment:

```bash
NODE_ENV=production
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
```

### 2. Authentication Flow

In production:
- Users must sign in before uploading images
- You can implement usage limits per user
- You can add payment/subscription logic through Clerk's user metadata

### 3. Deploy to Vercel

1. Push your code to GitHub
2. Import the repository in Vercel
3. Add environment variables in Vercel project settings:
   - `NODE_ENV=production`
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
4. Deploy!

### 4. Implementing Usage Limits (Future)

To charge per image, you can:
1. Store user credits in Clerk user metadata
2. Check credits before processing in `/api/generate`
3. Integrate Stripe/Paddle for payments
4. Deduct credits after successful image enhancement

Example:
```typescript
// In api/generate/route.ts
const { userId } = await auth();
// Check user credits
// Process image
// Deduct credits
```

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `development` or `production` |
| `SKIP_AUTH` | Optional | Set to `true` to bypass all authentication (default: `false`). Works in both dev and production. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | If auth enabled | Clerk publishable key (not needed if `SKIP_AUTH=true`) |
| `CLERK_SECRET_KEY` | If auth enabled | Clerk secret key (not needed if `SKIP_AUTH=true`) |
| `WHITELISTED_IPS` | Optional | Comma-separated IPs to bypass auth (e.g., `123.456.789.0,111.222.333.444`) |

