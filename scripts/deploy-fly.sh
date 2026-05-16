#!/bin/bash

# Deploy Build-Empire to Fly.io
# Prerequisites:
#   1. Create Fly account: https://fly.io
#   2. Install Fly CLI: curl -L https://fly.io/install.sh | sh
#   3. Authenticate: fly auth login

set -e

echo "🚀 Build-Empire Fly.io Deployment"
echo "=================================="

# Check for Fly CLI
if ! command -v flyctl &> /dev/null; then
    echo "❌ Fly CLI not found. Install with: curl -L https://fly.io/install.sh | sh"
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
    echo "❌ Uncommitted changes detected. Please commit or stash changes first"
    exit 1
fi

COMMIT=$(git rev-parse --short HEAD)
echo "📦 Deploying commit: $COMMIT"

# Check if fly.toml exists
if [ ! -f "fly.toml" ]; then
    echo "📝 Creating fly.toml configuration..."
    
    # Prompt for app name
    read -p "Enter Fly.io app name (e.g., build-empire-prod): " APP_NAME
    
    if [ -z "$APP_NAME" ]; then
        APP_NAME="build-empire-prod"
    fi
    
    cat > fly.toml << FLY_CONFIG
app = "$APP_NAME"
primary_region = "lax"

[build]
  image = "ghcr.io/givforks/build-empire:latest"

[env]
  NODE_ENV = "production"
  PORT = "4000"
  AUTO_RUN_MIGRATIONS = "true"

[[services]]
  internal_port = 4000
  processes = ["api"]
  protocol = "tcp"
  
  [services.concurrency]
    hard_limit = 25
    soft_limit = 20

  [[services.ports]]
    handlers = ["http"]
    port = 80
    
  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443

[[services]]
  internal_port = 3000
  processes = ["web"]
  protocol = "tcp"
  
  [[services.ports]]
    handlers = ["http"]
    port = 8080

[checks]
  [checks.http]
    grace_period = "10s"
    interval = "30s"
    method = "GET"
    path = "/health"
    timeout = "5s"
    type = "http"

FLY_CONFIG
    
    echo "✅ fly.toml created with app name: $APP_NAME"
    
    # Create Dockerfile if needed
    if [ ! -f "Dockerfile" ]; then
        echo "📝 Creating Dockerfile for Fly.io..."
        cat > Dockerfile << 'DOCKER_CONFIG'
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built apps
COPY apps/ ./apps/
COPY infra/ ./infra/
COPY scripts/ ./scripts/

# Expose ports
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start API
CMD ["npm", "run", "start:api"]
DOCKER_CONFIG
        echo "✅ Dockerfile created"
    fi
    
else
    echo "✅ fly.toml already exists"
fi

echo ""
echo "🔐 Setting up secrets..."
if [ -f "secrets/jwt_secret.txt" ]; then
    JWT_SECRET=$(cat secrets/jwt_secret.txt)
    flyctl secrets set JWT_SECRET="$JWT_SECRET" || echo "⚠️  Could not set JWT_SECRET (may need manual setup)"
fi

if [ -f "secrets/admin_password.txt" ]; then
    ADMIN_PASSWORD=$(cat secrets/admin_password.txt)
    flyctl secrets set ADMIN_PASSWORD="$ADMIN_PASSWORD" || echo "⚠️  Could not set ADMIN_PASSWORD"
fi

if [ -f "secrets/smtp_password.txt" ]; then
  SMTP_PASS=$(cat secrets/smtp_password.txt)
  flyctl secrets set SMTP_PASS="$SMTP_PASS" || echo "⚠️  Could not set SMTP_PASS"
fi

echo ""
echo "📋 Deployment Steps:"
echo "1. Build Docker image: docker build -t build-empire ."
echo "2. Push to registry: fly auth docker"
echo "3. Deploy: flyctl deploy"
echo ""
echo "Or run one command:"
echo "   flyctl deploy --local-only"
echo ""
echo "✅ Configuration ready for Fly.io deployment!"
