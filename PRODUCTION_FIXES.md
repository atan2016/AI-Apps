# Production Deployment Fixes

## Issues Identified

After manual deployment, you're seeing two main errors:

1. **Clerk Development Keys Warning**: The application is using Clerk development/test keys instead of production keys
2. **500 Error on Subscription Update**: The `/api/subscriptions/update` endpoint is failing

## Fixes Applied

### 1. Improved Error Handling
I've updated `app/api/subscriptions/update/route.ts` with better error handling that will:
- Check for missing environment variables
- Provide more detailed error messages
- Handle Stripe API errors gracefully
- Log specific failure points for debugging

### 2. Required Production Configuration

You need to update your production environment variables:

#### Clerk Keys (CRITICAL)
Replace your development keys with production keys:

```env
# ❌ WRONG - These are development keys (causes the warning)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# ✅ CORRECT - Use production keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
```

**How to get production keys:**
1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your production instance (or create one)
3. Go to "API Keys" section
4. Copy the **Live** keys (not Test keys)
5. Update your `.env` file on the server

#### Stripe Keys
Ensure you're using production Stripe keys:

```env
# Use live keys for production
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...  # From production webhook
```

#### Other Required Variables
Make sure all these are set:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Replicate
REPLICATE_API_TOKEN=your_replicate_token

# Deployment
USE_SUBDIRECTORY=true
SKIP_AUTH=false
```

## Deployment Steps

After updating environment variables:

1. **SSH into your server:**
   ```bash
   ssh your-server
   ```

2. **Navigate to your app directory:**
   ```bash
   cd /var/www/AI-Apps/emoji-generator
   ```

3. **Update environment variables:**
   ```bash
   sudo nano .env
   ```
   Update the Clerk and Stripe keys to production keys, then save.

4. **Pull latest code (if needed):**
   ```bash
   sudo git pull origin main
   ```

5. **Rebuild the application:**
   ```bash
   sudo npm install
   sudo npm run build
   ```

6. **Restart PM2:**
   ```bash
   sudo pm2 restart image-enhancer
   # Or if using a different name:
   sudo pm2 restart all
   ```

7. **Check logs:**
   ```bash
   sudo pm2 logs image-enhancer
   ```

## Verifying the Fix

1. **Check Clerk Warning:**
   - Open browser console
   - The warning about development keys should be gone
   - If you still see it, the keys weren't updated correctly

2. **Test Subscription Update:**
   - Try updating a subscription
   - Check browser console for detailed error messages
   - Check server logs: `sudo pm2 logs image-enhancer`

3. **Common Error Messages:**

   - `"Server configuration error: Stripe key missing"` → `STRIPE_SECRET_KEY` not set
   - `"Failed to retrieve subscription from Stripe"` → Stripe key is wrong or subscription doesn't exist
   - `"Database error: ..."` → Supabase connection issue
   - `"Unauthorized"` → Clerk authentication issue

## Debugging Tips

If errors persist:

1. **Check environment variables are loaded:**
   ```bash
   # On your server, check if variables are set
   cd /var/www/AI-Apps/emoji-generator
   sudo cat .env | grep CLERK
   sudo cat .env | grep STRIPE
   ```

2. **Verify PM2 has access to env vars:**
   ```bash
   # PM2 might need env vars set differently
   # Check PM2 ecosystem file or restart with env vars
   sudo pm2 restart image-enhancer --update-env
   ```

3. **Check server logs for detailed errors:**
   ```bash
   sudo pm2 logs image-enhancer --lines 100
   ```

4. **Test API endpoint directly:**
   ```bash
   # From your server, test if the endpoint is accessible
   curl -X POST http://localhost:3000/api/subscriptions/update \
     -H "Content-Type: application/json" \
     -d '{"priceId":"test","tier":"test"}'
   ```

## Next Steps

1. ✅ Update Clerk keys to production
2. ✅ Update Stripe keys to production (if not already)
3. ✅ Rebuild and restart the application
4. ✅ Test subscription update functionality
5. ✅ Monitor logs for any remaining errors

The improved error handling will now provide more specific error messages to help identify any remaining issues.





