#!/bin/bash

# Deploy Build-Empire to Render.com
# Prerequisites:
#   1. Create Render account: https://render.com
#   2. Connect GitHub repo to Render
#   3. Set environment variables in Render dashboard
#   4. Create PostgreSQL database service
#   5. Install Render CLI: npm install -g @render-com/cli

set -e

echo "🚀 Build-Empire Render.com Deployment"
echo "======================================"

# Check for Render CLI
if ! command -v render &> /dev/null; then
    echo "❌ Render CLI not found. Install with: npm install -g @render-com/cli"
    exit 1
fi

# Check for git
if ! command -v git &> /dev/null; then
    echo "❌ Git not found"
    exit 1
fi

# Verify we're in Build-Empire directory
if [ ! -f "package.json" ] || ! grep -q '"name": "build-empire"' package.json; then
    echo "❌ Please run this script from the Build-Empire root directory"
    exit 1
fi

# Check git status
if ! git diff-index --quiet HEAD --; then
    echo "❌ Uncommitted changes detected. Please commit or stash changes first:"
    git status
    exit 1
fi

REPO_NAME=$(git config --get remote.origin.url | grep -oP 'github\.com[:/]\K.*?(?=/|\.git|$)' || echo "Build-Empire")
BRANCH=$(git rev-parse --abbrev-ref HEAD)
COMMIT=$(git rev-parse --short HEAD)

echo "📦 Deployment Information:"
echo "   Repository: $REPO_NAME"
echo "   Branch: $BRANCH"
echo "   Commit: $COMMIT"
echo ""

# Create render.yaml if it doesn't exist
if [ ! -f "render.yaml" ]; then
    echo "📝 Creating render.yaml configuration..."
    cat > render.yaml << 'RENDER_CONFIG'
services:
  - type: web
    name: build-empire-api
    env: node
    plan: starter
    buildCommand: npm ci && npm run build -w @build-empire/api
    startCommand: npm run start:api
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 4000
      - key: DATABASE_URL
        fromDatabase:
          name: build-empire-db
          property: connectionString
      - key: JWT_SECRET_FILE
        value: /etc/secrets/jwt_secret
      - key: ADMIN_PASSWORD_FILE
        value: /etc/secrets/admin_password
      - key: SMTP_PASS_FILE
        value: /etc/secrets/smtp_password
      - key: AUTO_RUN_MIGRATIONS
        value: "true"

  - type: web
    name: build-empire-web
    env: node
    plan: starter
    buildCommand: npm ci && npm run build -w @build-empire/web
    startCommand: npm run preview -w @build-empire/web
    envVars:
      - key: NODE_ENV
        value: production
    routes:
      - path: /
        destination: build-empire-web:5173

databases:
  - name: build-empire-db
    databaseName: build_empire
    user: build_empire_user
    plan: starter

envVarGroups:
  - name: secrets
    envVars:
      - key: JWT_SECRET
        sync: false
      - key: ADMIN_PASSWORD
        sync: false
      - key: SMTP_PASS
        sync: false
RENDER_CONFIG
    echo "✅ render.yaml created"
else
    echo "✅ render.yaml already exists"
fi

echo ""
echo "📋 Manual Setup Steps:"
echo "1. Visit https://dashboard.render.com"
echo "2. Click 'New +' → 'Web Service'"
echo "3. Connect your GitHub repository"
echo "4. Select 'build-empire' and branch: $BRANCH"
echo "5. Configure build & start commands (use render.yaml settings above)"
echo "6. Add environment variables:"
echo "   - NODE_ENV=production"
echo "   - PORT=4000"
echo "   - JWT_SECRET (from secrets/jwt_secret.txt)"
echo "   - ADMIN_PASSWORD (from secrets/admin_password.txt)"
echo "   - SMTP_PASSWORD (from secrets/smtp_password.txt)"
echo ""
echo "7. Create PostgreSQL database service"
echo "8. Link DATABASE_URL to PostgreSQL service"
echo "9. Click 'Create Web Service'"
echo ""
echo "⚠️  Alternative: Automated with Render CLI:"
echo "   render up"
echo ""
echo "🎯 Your app will be live at: https://build-empire-api.onrender.com"
echo "   Web frontend: https://build-empire-web.onrender.com"
echo ""
echo "✅ Deployment configuration ready!"
