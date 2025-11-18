#!/bin/bash

# Deployment script for Image Enhancer
# Run this on your production server

set -e  # Exit on error

echo "🚀 Starting deployment..."

# Navigate to project directory
cd /var/www/AI-Apps/emoji-generator

# Pull latest changes
echo "📥 Pulling latest changes from git..."
sudo git pull origin main

# Install any new dependencies
echo "📦 Installing dependencies..."
sudo npm install

# Rebuild the application
# Use 'build' for subdomain (root path) or 'build:server' for subdirectory
echo "🔨 Building application..."
# For subdomain at root (imageenhancer.creators-lab.org): use 'build'
# For subdirectory (creators-lab.org/imageEnhancer): use 'build:server'
sudo npm run build

# Restart the application
echo "🔄 Restarting application..."
sudo pm2 restart image-enhancer

# Show status
echo "✅ Deployment complete!"
echo ""
echo "📊 Application status:"
sudo pm2 status image-enhancer

echo ""
echo "📝 Recent logs:"
sudo pm2 logs image-enhancer --lines 20 --nostream

