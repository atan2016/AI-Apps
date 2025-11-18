# Image Cleanup & Storage Monitoring Setup

This document explains how to set up automatic image cleanup and storage monitoring.

## Features

1. **24-Hour Image Deletion**: Images are automatically deleted after 24 hours to save storage space
2. **User Notifications**: Users see countdown timers on images showing hours until deletion
3. **Storage Monitoring**: Automatic email alerts when storage approaches the Supabase free plan limit (1 GB)

## Setup Instructions

### 1. Email Configuration (Optional but Recommended)

To receive storage limit alerts, configure SMTP settings in your `.env` file:

```env
# SMTP Configuration for Email Alerts
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com
```

**For Gmail:**
1. Enable 2-factor authentication
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the app password as `SMTP_PASS`

**Alternative Email Services:**
- **SendGrid**: Use their SMTP settings
- **Resend**: Use their SMTP settings
- **AWS SES**: Use their SMTP settings

**Note:** If SMTP is not configured, email alerts will be logged to the console instead.

### 2. Cleanup API Token (Optional but Recommended)

For security, set a cleanup API token in your `.env`:

```env
CLEANUP_API_TOKEN=your-secret-token-here
```

This token is required when calling the cleanup endpoint (unless not set, then it's open).

### 3. Set Up Automated Cleanup

You need to call the cleanup endpoint regularly (every hour recommended). Here are several options:

#### Option A: Using a Cron Job (Linux/Mac)

Add to your crontab (`crontab -e`):

```bash
# Run cleanup every hour
0 * * * * curl -X DELETE http://localhost:5001/api/cleanup -H "Authorization: Bearer your-secret-token-here"
```

For production:

```bash
# Run cleanup every hour on production server
0 * * * * curl -X DELETE https://yourdomain.com/api/cleanup -H "Authorization: Bearer your-secret-token-here"
```

#### Option B: Using GitHub Actions (Free)

Create `.github/workflows/cleanup.yml`:

```yaml
name: Image Cleanup

on:
  schedule:
    - cron: '0 * * * *'  # Every hour
  workflow_dispatch:  # Allow manual trigger

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Run Cleanup
        run: |
          curl -X DELETE https://yourdomain.com/api/cleanup \
            -H "Authorization: Bearer ${{ secrets.CLEANUP_API_TOKEN }}"
```

#### Option C: Using Vercel Cron Jobs

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cleanup",
      "schedule": "0 * * * *"
    }
  ]
}
```

#### Option D: Using a Node.js Script

Create `scripts/cleanup.js`:

```javascript
const fetch = require('node-fetch');

async function runCleanup() {
  const response = await fetch('http://localhost:5001/api/cleanup', {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${process.env.CLEANUP_API_TOKEN}`
    }
  });
  
  const result = await response.json();
  console.log('Cleanup result:', result);
}

runCleanup();
```

Then run with PM2 or a scheduler:

```bash
# Install PM2
npm install -g pm2

# Run cleanup every hour
pm2 start scripts/cleanup.js --cron "0 * * * *"
```

### 4. Storage Monitoring

The cleanup endpoint also monitors storage usage. Call it with GET to check:

```bash
curl http://localhost:5001/api/cleanup
```

This will:
- Estimate current storage usage
- Send an email alert to `ashleyt@gmail.com` if usage exceeds 90% of 1 GB limit
- Return current usage statistics

### 5. Manual Cleanup

You can manually trigger cleanup:

```bash
# Delete images older than 24 hours
curl -X DELETE http://localhost:5001/api/cleanup \
  -H "Authorization: Bearer your-secret-token-here"
```

## API Endpoints

### DELETE /api/cleanup
Deletes all images older than 24 hours from both Supabase Storage and the database.

**Headers:**
- `Authorization: Bearer {CLEANUP_API_TOKEN}` (optional if token not set)

**Response:**
```json
{
  "success": true,
  "deletedCount": 15,
  "errorCount": 0,
  "message": "Deleted 15 images older than 24 hours"
}
```

### GET /api/cleanup
Checks storage usage and sends email alerts if needed.

**Response:**
```json
{
  "estimatedUsage": 524288000,
  "limit": 1073741824,
  "percentage": "48.83",
  "imageCount": 1024,
  "alertSent": false
}
```

## User Experience

- **Image Cards**: Show countdown timer (e.g., "Download within 23h")
- **Warning at 6 hours**: Orange warning appears when less than 6 hours remain
- **Main Page Notice**: Blue banner at top explaining 24-hour policy

## Storage Limits

- **Supabase Free Plan**: 1 GB storage limit
- **Alert Threshold**: 90% (900 MB)
- **Email Recipient**: ashleyt@gmail.com (hardcoded in code)

## Troubleshooting

### Emails not sending
- Check SMTP configuration in `.env`
- Verify SMTP credentials are correct
- Check server logs for email errors
- If SMTP not configured, emails are logged to console

### Cleanup not running
- Verify cron job is set up correctly
- Check API endpoint is accessible
- Verify CLEANUP_API_TOKEN if set
- Check server logs for errors

### Images not deleting
- Verify images have `created_at` timestamp in database
- Check Supabase Storage permissions
- Verify cleanup endpoint is being called
- Check server logs for deletion errors

