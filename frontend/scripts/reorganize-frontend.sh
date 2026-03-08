#!/bin/bash
# reorganize-frontend.sh
# Reorganizes frontend folder structure to match project

set -e  # Exit on error

FRONTEND_DIR="/home/kenneth/Documents/Workplace/WebsiteTemplate2/frontend"
cd "$FRONTEND_DIR/src"

echo "🔄 Reorganizing frontend folder structure..."

# Create shared directory
echo "📁 Creating shared directory..."
mkdir -p shared

# Move directories to shared
echo "📦 Moving directories to shared/..."
mv components shared/ 2>/dev/null || echo "⚠️  components already moved"
mv constants shared/ 2>/dev/null || echo "⚠️  constants already moved"
mv contexts shared/ 2>/dev/null || echo "⚠️  contexts already moved"
mv hooks shared/ 2>/dev/null || echo "⚠️  hooks already moved"
mv lib shared/ 2>/dev/null || echo "⚠️  lib already moved"
mv providers shared/ 2>/dev/null || echo "⚠️  providers already moved"
mv services shared/ 2>/dev/null || echo "⚠️  services already moved"
mv types shared/ 2>/dev/null || echo "⚠️  types already moved"
mv utils shared/ 2>/dev/null || echo "⚠️  utils already moved"

# Create i18n directory
echo "🌍 Creating i18n directory..."
mkdir -p shared/i18n

echo "✅ Folder reorganization complete!"
echo ""
echo "New structure:"
tree -L 2 -d .
