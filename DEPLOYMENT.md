# Deployment Guide for Ubuntu Server

Deploy Image Enhancer to `http://creators-lab.org/imageEnhancer`

## Prerequisites

- Ubuntu server with SSH access
- Node.js 18+ installed
- Nginx installed
- Domain `creators-lab.org` pointing to your server
- Git installed

## Step 1: Install Node.js (if not installed)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

## Step 2: Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

## Step 3: Clone Your Repository

```bash
# Navigate to your web directory
cd /var/www

# Clone your repository
sudo git clone https://github.com/atan2016/AI-Apps.git
cd AI-Apps/emoji-generator

# Or if already cloned, pull latest changes
cd /var/www/AI-Apps/emoji-generator
sudo git pull origin main
```

## Step 4: Set Up Environment Variables

```bash
# Create .env file
sudo nano .env
```

Add all your environment variables:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Replicate
REPLICATE_API_TOKEN=your_replicate_token

# Optional: Skip auth for development
SKIP_AUTH=false
ALLOWED_IPS=
```

Save and exit (Ctrl+X, Y, Enter)

## Step 5: Install Dependencies and Build

```bash
# Install dependencies
sudo npm install

# Build the application
sudo npm run build
```

## Step 6: Set Up PM2

```bash
# Start the application with PM2
sudo pm2 start npm --name "image-enhancer" -- start

# Save PM2 configuration
sudo pm2 save

# Set PM2 to start on boot
sudo pm2 startup systemd
# Follow the command it gives you (copy and run it)
```

## Step 7: Configure Nginx

```bash
# Edit Nginx configuration
sudo nano /etc/nginx/sites-available/creators-lab.org
```

Add this location block to your existing server configuration:

```nginx
server {
    listen 80;
    server_name creators-lab.org www.creators-lab.org;

    # ... your existing configuration ...

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
        proxy_pass http://localhost:3000/_next/static;
        proxy_cache_valid 200 60m;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Test and reload Nginx:

```bash
# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

## Step 8: Verify Deployment

Visit: `http://creators-lab.org/imageEnhancer`

## Managing the Application

### View Logs
```bash
sudo pm2 logs image-enhancer
```

### Restart Application
```bash
sudo pm2 restart image-enhancer
```

### Stop Application
```bash
sudo pm2 stop image-enhancer
```

### Check Status
```bash
sudo pm2 status
```

## Updating the Application

```bash
# Navigate to project directory
cd /var/www/AI-Apps/emoji-generator

# Pull latest changes
sudo git pull origin main

# Install any new dependencies
sudo npm install

# Rebuild
sudo npm run build

# Restart
sudo pm2 restart image-enhancer
```

## Troubleshooting

### Check if app is running
```bash
curl http://localhost:3000/imageEnhancer
```

### Check Nginx error logs
```bash
sudo tail -f /var/log/nginx/error.log
```

### Check PM2 logs
```bash
sudo pm2 logs image-enhancer --lines 100
```

### Port already in use
```bash
# Find process on port 3000
sudo lsof -i :3000

# Kill process
sudo kill -9 <PID>
```

## Optional: Set Up SSL (HTTPS)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d creators-lab.org -d www.creators-lab.org

# Auto-renewal is set up automatically
```

After SSL setup, your site will be accessible at:
`https://creators-lab.org/imageEnhancer`

## Security Recommendations

1. **Firewall**: Ensure only ports 80, 443, and SSH are open
```bash
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 22
sudo ufw enable
```

2. **Environment Variables**: Never commit `.env` to git

3. **Regular Updates**: Keep Node.js, PM2, and system packages updated

4. **Monitoring**: Set up PM2 monitoring or use a service like Datadog

## Performance Tips

1. **Enable caching** in Nginx for static assets (already configured above)
2. **Use HTTP/2** with SSL for better performance
3. **Monitor Replicate API usage** to control costs
4. **Set up database connection pooling** in Supabase

---

**Need Help?** Check the logs first with `sudo pm2 logs image-enhancer`
