#!/bin/bash

# Deploy Build-Empire to DigitalOcean App Platform
# Prerequisites:
#   1. Create DigitalOcean account: https://www.digitalocean.com
#   2. Create an API token in account settings
#   3. Connect GitHub repository
#   4. Create database cluster (PostgreSQL)

set -e

echo "🚀 Build-Empire DigitalOcean Deployment"
echo "========================================"

# Check for required tools
if ! command -v git &> /dev/null; then
    echo "❌ Git not found"
    exit 1
fi

# Verify we're in Build-Empire directory
if [ ! -f "package.json" ] || ! grep -q '"name": "build-empire"' package.json; then
    echo "❌ Please run this script from the Build-Empire root directory"
    exit 1
fi

COMMIT=$(git rev-parse --short HEAD)
echo "📦 Deploying commit: $COMMIT"

# Create app.yaml if it doesn't exist
if [ ! -f "app.yaml" ]; then
    echo "📝 Creating app.yaml for DigitalOcean..."
    cat > app.yaml << 'APP_CONFIG'
name: build-empire
services:
  - name: api
    github:
      repo: Givforks/Build-Empire
      branch: main
      deploy_on_push: true
    build_command: npm ci && npm run build -w @build-empire/api
    run_command: npm run start:api
    envs:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: "4000"
      - key: AUTO_RUN_MIGRATIONS
        value: "true"
      - key: DATABASE_URL
        scope: RUN_TIME
        value: ${db.username}:${db.password}@${db.host}:${db.port}/${db.name}?sslmode=require
    http_port: 4000
    health_check:
      http_path: /health
      period_seconds: 60
      timeout_seconds: 10
      success_threshold: 2
      failure_threshold: 3
    source_dir: apps/api
    resources:
      requests:
        memory: 512Mi
        cpu: 0.25

  - name: web
    github:
      repo: Givforks/Build-Empire
      branch: main
      deploy_on_push: true
    build_command: npm ci && npm run build -w @build-empire/web
    run_command: npm run preview -w @build-empire/web
    envs:
      - key: NODE_ENV
        value: production
    http_port: 5173
    health_check:
      http_path: /
      period_seconds: 60
      timeout_seconds: 10
    source_dir: apps/web
    resources:
      requests:
        memory: 256Mi
        cpu: 0.1

databases:
  - engine: PG
    name: build-empire-db
    version: "16"
    production: true
    users:
      - name: build_empire
    dbs:
      - name: build_empire

APP_CONFIG
    echo "✅ app.yaml created"
else
    echo "✅ app.yaml already exists"
fi

echo ""
echo "📋 DigitalOcean Deployment Steps:"
echo "1. Log in to DigitalOcean: https://cloud.digitalocean.com"
echo "2. Go to 'Apps' → 'Create App'"
echo "3. Choose 'GitHub' source and select 'Givforks/Build-Empire'"
echo "4. Select 'app.yaml' as the configuration file (or copy contents)"
echo "5. Configure environment variables:"
echo "   - DATABASE_URL (auto-linked from PostgreSQL)"
echo "   - JWT_SECRET (from secrets/jwt_secret.txt)"
echo "   - ADMIN_PASSWORD (from secrets/admin_password.txt)"
echo "   - SMTP_PASSWORD (from secrets/smtp_password.txt)"
echo ""
echo "6. Create PostgreSQL database cluster:"
echo "   - Version: 16 (Managed Database)"
echo "   - Connection name: build-empire-db"
echo "   - User: build_empire"
echo ""
echo "7. Link database to app services"
echo "8. Click 'Deploy'"
echo ""
echo "🎯 Your app will be live at: https://build-empire.ondigitalocean.app"
echo ""
echo "📚 Reference:"
echo "   Docs: https://docs.digitalocean.com/products/app-platform/"
echo "   App Spec: https://docs.digitalocean.com/products/app-platform/references/app-spec/"
echo ""
echo "✅ Configuration ready for DigitalOcean deployment!"
