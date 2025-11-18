# SMTP Troubleshooting Guide

This guide will help you diagnose and fix SMTP email sending issues.

## Quick Test

Run the diagnostic script:
```bash
node scripts/test-smtp.js
```

This will test your SMTP configuration step-by-step and show exactly where any issues occur.

## Step-by-Step Troubleshooting

### 1. Check Your .env File

**Location:** `/Users/ashleytan/Documents/emoji-generator/emoji-generator/.env`

**Required Variables:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password-here
SMTP_FROM=noreply@imageenhancer.com
```

**Common Issues:**
- ❌ Missing variables
- ❌ Extra spaces around `=`
- ❌ Quotes around values (usually not needed)
- ❌ Comments on same line as variable

**Correct Format:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```

**Wrong Format:**
```env
SMTP_HOST = smtp.gmail.com  # ❌ Extra spaces
SMTP_HOST="smtp.gmail.com"  # ❌ Quotes (usually not needed)
SMTP_HOST=smtp.gmail.com # comment  # ❌ Comment on same line
```

### 2. Gmail-Specific Setup

#### Step 1: Enable 2-Factor Authentication
1. Go to: https://myaccount.google.com/security
2. Under "Signing in to Google", click "2-Step Verification"
3. Follow the prompts to enable it

#### Step 2: Generate App Password
1. Go to: https://myaccount.google.com/apppasswords
2. Select "Mail" as the app
3. Select "Other (Custom name)" as the device
4. Enter "Image Enhancer" as the name
5. Click "Generate"
6. Copy the 16-character password (looks like: `abcd efgh ijkl mnop`)
7. **Remove spaces** when adding to .env: `SMTP_PASS=abcdefghijklmnop`

**Important:** 
- Use the App Password, NOT your regular Gmail password
- App Passwords are 16 characters (no spaces in .env file)
- If you lose it, generate a new one

#### Step 3: Verify Gmail Settings
- Make sure "Less secure app access" is NOT needed (App Passwords replace this)
- Check that your account isn't locked or restricted

### 3. Other Email Providers

#### Outlook/Hotmail
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
```

#### Yahoo
```env
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_USER=your-email@yahoo.com
SMTP_PASS=your-app-password
```

#### Custom SMTP (SendGrid, AWS SES, etc.)
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-api-key
```

### 4. Port Configuration

**Port 587 (TLS/STARTTLS)** - Recommended
- Most common and secure
- Works with most providers
- Use with: `SMTP_PORT=587`

**Port 465 (SSL)**
- Older SSL method
- Use with: `SMTP_PORT=465`
- Note: Script automatically sets `secure: true` for port 465

**Port 25**
- Usually blocked by ISPs
- Not recommended

### 5. Common Error Messages

#### "Missing required SMTP configuration"
**Solution:** Check that all 4 required variables are in your .env file:
- SMTP_HOST
- SMTP_PORT
- SMTP_USER
- SMTP_PASS

#### "SMTP connection failed" or "ECONNREFUSED"
**Possible Causes:**
1. Wrong SMTP_HOST
2. Firewall blocking port
3. Network restrictions
4. SMTP server is down

**Solutions:**
- Verify SMTP_HOST is correct for your provider
- Try a different network (some block SMTP)
- Check if port 587 is accessible: `telnet smtp.gmail.com 587`
- Try port 465 instead

#### "Invalid login" or "Authentication failed"
**Possible Causes:**
1. Wrong username/password
2. Using regular password instead of App Password (Gmail)
3. Account locked or restricted
4. 2FA not enabled (Gmail)

**Solutions:**
- For Gmail: Use App Password, not regular password
- Double-check username (full email address)
- Verify password has no extra spaces
- Try generating a new App Password

#### "Connection timeout"
**Possible Causes:**
1. Firewall blocking connection
2. Network restrictions
3. Wrong port number

**Solutions:**
- Try different network (mobile hotspot)
- Check firewall settings
- Verify port number is correct
- Try port 465 if 587 doesn't work

#### "Message rejected" or "Relay access denied"
**Possible Causes:**
1. SMTP server requires authentication
2. Account restrictions
3. Rate limiting

**Solutions:**
- Verify credentials are correct
- Check account status
- Wait a few minutes and try again

### 6. Testing Network Connectivity

Test if you can reach the SMTP server:

```bash
# Test Gmail SMTP
telnet smtp.gmail.com 587

# Or use nc (netcat)
nc -zv smtp.gmail.com 587
```

If connection fails, your network may be blocking SMTP.

### 7. Debug Mode

To see more detailed error information, check the server console logs when running the test script. The script will show:
- Which step failed
- Exact error messages
- Troubleshooting suggestions

### 8. Alternative: Use Email Service Providers

If SMTP continues to be problematic, consider using:
- **SendGrid** (free tier: 100 emails/day)
- **Resend** (free tier: 3,000 emails/month)
- **AWS SES** (very cheap, pay-as-you-go)
- **Mailgun** (free tier: 5,000 emails/month)

These services provide:
- More reliable delivery
- Better error messages
- Analytics and tracking
- Easier setup (API keys instead of SMTP)

### 9. Verify .env File is Being Read

The test script will show:
```
Looking for .env file at: /path/to/.env
✅ Found .env file, loading variables...
Loaded X SMTP-related variables.
```

If it shows "Loaded 0 SMTP-related variables", your .env file format may be incorrect.

### 10. Still Having Issues?

1. **Run the diagnostic script** and copy the full output
2. **Check the error message** - it will tell you exactly what failed
3. **Verify each step:**
   - ✅ .env file exists and is readable
   - ✅ All variables are set correctly
   - ✅ No extra spaces or quotes
   - ✅ Using App Password for Gmail
   - ✅ Network allows SMTP connections
   - ✅ Port is correct for your provider

## Quick Checklist

Before running the test, verify:
- [ ] .env file exists in project root
- [ ] SMTP_HOST is set (e.g., `smtp.gmail.com`)
- [ ] SMTP_PORT is set (e.g., `587`)
- [ ] SMTP_USER is set (your full email address)
- [ ] SMTP_PASS is set (App Password for Gmail)
- [ ] No extra spaces around `=` sign
- [ ] For Gmail: 2FA is enabled
- [ ] For Gmail: Using App Password, not regular password
- [ ] Network allows SMTP connections (port 587 or 465)

## Getting Help

If you're still stuck, provide:
1. Full output from `node scripts/test-smtp.js`
2. Your email provider (Gmail, Outlook, etc.)
3. Any error messages you see
4. Whether you're using App Password (Gmail) or regular password

