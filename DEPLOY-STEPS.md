# Step-by-Step Deployment Instructions

Deploy Image Enhancer to `http://creators-lab.org/imageEnhancer`

---

## STEP 1: SSH into Your Ubuntu Server

```bash
ssh your-username@creators-lab.org
# Or: ssh your-username@your-server-ip
```

---

## STEP 2: Check if Node.js is Installed

```bash
node --version
npm --version
```

**If not installed or version is less than 18**, install Node.js 20:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Should show v20.x.x
```

---

## STEP 3: Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
pm2 --version
```

---

## STEP 4: Navigate to Web Directory and Clone Repository

```bash
# Go to web directory (create if doesn't exist)
cd /var/www

# Clone your repository
sudo git clone https://github.com/atan2016/AI-Apps.git

# Navigate to the project
cd AI-Apps/emoji-generator

# Verify you're in the right place
pwd  # Should show: /var/www/AI-Apps/emoji-generator
ls   # Should show package.json, app/, etc.
```

**If already cloned**, just pull latest changes:

```bash
cd /var/www/AI-Apps/emoji-generator
sudo git pull origin main
```

---

## STEP 5: Create Environment Variables File

```bash
# Create .env file
sudo nano .env
```

**Copy and paste your environment variables** (get them from your local `.env` file):

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Replicate
REPLICATE_API_TOKEN=r8_...

# Optional
SKIP_AUTH=false
```

**Save and exit:**
- Press `Ctrl + X`
- Press `Y`
- Press `Enter`

**Verify the file was created:**

```bash
cat .env
```

---

## STEP 6: Install Dependencies

```bash
sudo npm install
```

This will take 2-3 minutes. Wait for it to complete.

---

## STEP 7: Build the Application for Server

```bash
sudo npm run build:server
```

**Note:** This uses `build:server` (not `build`) to enable the `/imageEnhancer` subdirectory path.

This will take 3-5 minutes. You should see:

```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages
```

---

## STEP 8: Start the Application with PM2

```bash
# Start the app with subdirectory path enabled
sudo pm2 start npm --name "image-enhancer" -- run start:server

# Check status
sudo pm2 status
```

You should see `image-enhancer` with status `online`.

**Save PM2 configuration:**

```bash
sudo pm2 save
```

**Set PM2 to auto-start on server reboot:**

```bash
sudo pm2 startup systemd
```

This will output a command like:

```
sudo env PATH=... pm2 startup systemd -u root --hp /root
```

**Copy and run that exact command** it gives you.

---

## STEP 9: Test the Application

```bash
# Test if app is responding
curl http://localhost:3000/imageEnhancer

# You should see HTML output with "<!DOCTYPE html>"
```

**Check logs:**

```bash
sudo pm2 logs image-enhancer --lines 20
```

Press `Ctrl + C` to exit logs.

---

## STEP 10: Configure Nginx

**Check if Nginx is installed:**

```bash
nginx -v
```

**If not installed:**

```bash
sudo apt update
sudo apt install nginx -y
```

**Edit Nginx configuration:**

```bash
sudo nano /etc/nginx/sites-available/creators-lab.org
```

**If file doesn't exist**, create it. **Add this configuration:**

```nginx
server {
    listen 80;
    server_name creators-lab.org www.creators-lab.org;

    # Image Enhancer application
    location /imageEnhancer {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Increase timeout for AI processing
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
    }

    # Handle static assets
    location /imageEnhancer/_next/static {
        proxy_pass http://localhost:3000/imageEnhancer/_next/static;
        proxy_cache_valid 200 60m;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Optional: Your other sites/applications
    # location / {
    #     root /var/www/html;
    #     index index.html;
    # }
}
```

**If you already have a server block**, just add the `location /imageEnhancer` sections inside your existing `server { }` block.

**Save and exit** (Ctrl+X, Y, Enter)

---

## STEP 11: Enable the Site and Test Nginx

```bash
# Create symbolic link (if not already exists)
sudo ln -s /etc/nginx/sites-available/creators-lab.org /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t
```

You should see:

```
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

**If you see errors**, check the Nginx config file again.

**Reload Nginx:**

```bash
sudo systemctl reload nginx
```

---

## STEP 12: Open Firewall (if UFW is enabled)

```bash
# Check firewall status
sudo ufw status

# If active, allow HTTP and HTTPS
sudo ufw allow 80
sudo ufw allow 443
```

---

## STEP 13: Verify Deployment

**From your server:**

```bash
curl http://localhost/imageEnhancer
```

**From your local machine** (open browser):

```
http://creators-lab.org/imageEnhancer
```

You should see your Image Enhancer application! 🎉

---

## STEP 14: Monitor and Manage

**View logs:**

```bash
sudo pm2 logs image-enhancer
```

**Restart app:**

```bash
sudo pm2 restart image-enhancer
```

**Check status:**

```bash
sudo pm2 status
```

---

## Troubleshooting

### Problem: Can't access from browser

**Check if app is running:**

```bash
sudo pm2 status
curl http://localhost:3000/imageEnhancer
```

**Check Nginx:**

```bash
sudo systemctl status nginx
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

### Problem: Port 3000 already in use

```bash
# Find what's using port 3000
sudo lsof -i :3000

# Kill it
sudo kill -9 <PID>

# Restart your app
sudo pm2 restart image-enhancer
```

### Problem: App crashes immediately

```bash
# Check logs
sudo pm2 logs image-enhancer --lines 50

# Common issues:
# - Missing environment variables in .env
# - Wrong Node.js version
# - Build errors
```

### Problem: Environment variables not loaded

```bash
# Make sure .env is in the project root
cd /var/www/AI-Apps/emoji-generator
ls -la .env

# Rebuild and restart
sudo npm run build
sudo pm2 restart image-enhancer
```

---

## Optional: Set Up SSL (HTTPS)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d creators-lab.org -d www.creators-lab.org

# Follow the prompts
# Auto-renewal is configured automatically
```

After SSL, access at: `https://creators-lab.org/imageEnhancer`

---

## Updating the Application Later

When you make changes and push to GitHub:

```bash
# SSH into server
ssh your-username@creators-lab.org

# Navigate to project
cd /var/www/AI-Apps/emoji-generator

# Pull latest changes
sudo git pull origin main

# Install any new dependencies
sudo npm install

# Rebuild for server
sudo npm run build:server

# Restart
sudo pm2 restart image-enhancer

# Check status
sudo pm2 logs image-enhancer
```

---

## Quick Reference Commands

```bash
# Start app
sudo pm2 start npm --name "image-enhancer" -- run start:server

# Stop app
sudo pm2 stop image-enhancer

# Restart app
sudo pm2 restart image-enhancer

# View logs
sudo pm2 logs image-enhancer

# Status
sudo pm2 status

# Reload Nginx
sudo systemctl reload nginx

# Test Nginx config
sudo nginx -t
```

---

**🎉 Your Image Enhancer is now live at `http://creators-lab.org/imageEnhancer`!**

If you encounter any issues, check the logs first:
- PM2 logs: `sudo pm2 logs image-enhancer`
- Nginx logs: `sudo tail -f /var/log/nginx/error.log`

