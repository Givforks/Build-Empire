# Build-Empire Deployment Guide

This guide covers deploying Build-Empire to multiple cloud platforms. Choose one based on your preference.

---

## Prerequisites (All Platforms)

### 1. Local Setup
```bash
cd /home/givenchi/Build-Empire
npm run bootstrap:prod  # Generates .env, secrets/, and TLS certs
npm run smoke          # Validates your setup end-to-end
```

### 2. GitHub Repository
- Repo must be pushed to GitHub: `https://github.com/Givforks/Build-Empire`
- Ensure CI/CD pipeline passes (GitHub Actions checks main branch)

### 3. Environment Variables
Every platform requires these (set in platform dashboard or `--env-file`):
```
NODE_ENV=production
PORT=4010
DATABASE_URL=postgres://user:pass@db_host:5432/build_empire
JWT_SECRET_FILE=/run/secrets/jwt_secret
ADMIN_PASSWORD_FILE=/run/secrets/admin_password
ADMIN_USERNAME=GivenchiCodes
SMTP_HOST=smtp.gmail.com (or your provider)
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS_FILE=/run/secrets/smtp_password
DEEPSEEK_API_KEY=your_api_key
FRONTEND_URL=https://your-domain.com
DATA_DIR=/data  (for persistent storage if using file-based DB)
AUTO_RUN_MIGRATIONS=true  (to auto-migrate PostgreSQL schema on startup)
```

---

## Platform-Specific Guides

### 1. Render.com (Recommended for Beginners)

**Why Render?**
- One-click GitHub integration
- Free tier available
- Auto-deploys on git push
- Built-in PostgreSQL addon

**Steps:**

1. **Create Render Account**
   ```
   https://dashboard.render.com/register
   ```

2. **Run Deployment Script**
   ```bash
   npm run deploy:render
   ```
   The script will:
   - Check for Render CLI installation
   - Create Procfile for web/API services
   - Output next steps

3. **Manual Dashboard Setup** (if script doesn't complete)
   - Go to https://dashboard.render.com
   - Click "New" → "Web Service"
   - Connect your GitHub repo `Givforks/Build-Empire`
   - Set build command: `npm run build`
   - Set start command: `npm run start:prod`
   - Add PostgreSQL database addon
   - Set environment variables (see Prerequisites)
   - Deploy

4. **Verify Deployment**
   ```bash
   curl https://your-render-app.onrender.com/health
   # Should return 200 with { status: 'ok' }
   ```

**Cost**: ~$7/month (web service + PostgreSQL)
**Scaling**: Use Render dashboard → Instances

---

### 2. Fly.io (Best for Advanced Users)

**Why Fly.io?**
- Global edge deployment
- PostgreSQL managed database
- Excellent performance
- Pay-per-use pricing

**Steps:**

1. **Create Fly Account & Install CLI**
   ```bash
   # Sign up
   https://fly.io/app/sign-up
   
   # Install flyctl
   curl -L https://fly.io/install.sh | sh
   
   # Login
   flyctl auth login
   ```

2. **Run Deployment Script**
   ```bash
   npm run deploy:fly
   ```
   The script will:
   - Generate `fly.toml` configuration
   - Create app on Fly
   - Provision PostgreSQL
   - Deploy containers

3. **Manual Deployment** (if needed)
   ```bash
   flyctl apps create build-empire
   flyctl secrets set NODE_ENV=production JWT_SECRET=$(cat secrets/jwt_secret.txt)
   flyctl postgres create --org personal build-empire-db
   flyctl deploy
   ```

4. **Verify Deployment**
   ```bash
   flyctl status
   flyctl open /health
   ```

**Cost**: $0-20/month depending on usage
**Scaling**: `flyctl scale count=3` (adds instances)

---

### 3. DigitalOcean App Platform

**Why DigitalOcean?**
- Predictable pricing ($5-50/month)
- Managed PostgreSQL
- Simple YAML config
- Good support

**Steps:**

1. **Create DigitalOcean Account**
   ```
   https://cloud.digitalocean.com/registrations/new
   ```

2. **Run Deployment Script**
   ```bash
   npm run deploy:digitalocean
   ```
   The script will:
   - Generate `app.yaml` for App Platform
   - Output commands to create managed DB
   - Show deploy instructions

3. **Manual Deployment**
   ```bash
   # Connect GitHub via DigitalOcean dashboard
   # Upload app.yaml via dashboard
   # Create managed PostgreSQL database
   # Set environment variables
   # Click Deploy
   ```

4. **Verify Deployment**
   ```bash
   doctl apps list
   doctl apps get <app-id>
   # Check deployment status in dashboard
   ```

**Cost**: $5-50/month
**Scaling**: Adjust resource tiers in app.yaml (spec.services[].resources)

---

### 4. AWS (For Enterprise/Complex Setups)

**Why AWS?**
- Maximum control and flexibility
- Auto-scaling
- CDN + load balancing included
- Best for high-traffic scenarios

**Architecture**:
- ECS Fargate (containers)
- RDS PostgreSQL (database)
- ALB (load balancer)
- CloudFront (CDN)

**Steps:**

1. **Create AWS Account & Install Tools**
   ```bash
   # Install AWS CLI
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install
   
   # Configure credentials
   aws configure
   ```

2. **Run Deployment Script** (generates Terraform hints)
   ```bash
   npm run deploy:aws
   ```

3. **Infrastructure Setup** (choose one method):

   **Option A: Terraform** (Recommended)
   ```bash
   # Script generates terraform recommendations
   # Create infra/terraform/main.tf with:
   # - ECS cluster + task definition
   # - RDS PostgreSQL instance
   # - ALB + target groups
   # - Auto Scaling Group
   
   terraform init
   terraform plan
   terraform apply
   ```

   **Option B: AWS Console** (Manual)
   - Create ECS cluster
   - Create RDS PostgreSQL database
   - Push Docker images to ECR
   - Create task definition
   - Create service + load balancer
   - Configure Route 53 DNS

4. **Deploy**
   ```bash
   # Push images to ECR
   aws ecr get-login-password | docker login --username AWS --password-stdin <ECR_URI>
   docker tag build-empire-api:latest <ECR_URI>/build-empire-api:latest
   docker push <ECR_URI>/build-empire-api:latest
   
   # Update ECS service (triggers rolling update)
   aws ecs update-service \
     --cluster build-empire \
     --service build-empire-api \
     --force-new-deployment
   ```

5. **Verify Deployment**
   ```bash
   aws ecs describe-services --cluster build-empire --services build-empire-api
   # Check ALB health in AWS console
   ```

**Cost**: $20-200+/month (depends on traffic)
**Scaling**: Auto Scaling Group policies handle automatic scaling

---

## Local Production Testing

Before deploying to cloud, test locally:

```bash
# Generate production config
npm run bootstrap:prod

# Start with docker compose (includes PostgreSQL)
npm run docker:up:prod

# Run smoke tests
npm run smoke

# View logs
npm run docker:logs

# Cleanup
npm run docker:down:prod
```

---

## Post-Deployment Checklist

1. **Health Check**
   ```bash
   curl https://your-app-url/health
   ```

2. **Smoke Test Flow**
   - Visit frontend: `https://your-app-url`
   - Sign up as client
   - Create appointment
   - Check admin dashboard
   - Verify email dispatch logs

3. **Database Verification**
   ```bash
   # Check migrations ran
   # Verify data persisted across restarts
   ```

4. **SSL Certificate**
   - Verify HTTPS works
   - Check certificate validity
   - Plan renewal (LetsEncrypt auto-renewal for prod)

5. **Monitoring Setup**
   - Enable platform logs (Render/Fly/DO/AWS)
   - Set up error alerts
   - Configure uptime monitoring

---

## Rollback Procedures

### Render.com
```bash
# Revert to previous deployment
# Dashboard → Deployments → Previous version → Redeploy
```

### Fly.io
```bash
flyctl releases list
flyctl releases rollback <VERSION>
```

### DigitalOcean
```bash
# Dashboard → App → Deployments → Previous → Redeploy
```

### AWS
```bash
# Update ECS service to previous task definition version
aws ecs update-service \
  --cluster build-empire \
  --service build-empire-api \
  --task-definition build-empire-api:PREVIOUS_VERSION
```

---

## Troubleshooting

### Common Issues

**"Database connection refused"**
- Verify DATABASE_URL environment variable
- Check database is running and accessible
- For AWS: verify security groups allow port 5432

**"API not responding"**
- Check logs: `npm run docker:logs` (local) or platform logs (cloud)
- Verify port is correct (4010 for API)
- Check JWT_SECRET is set

**"Frontend can't reach API"**
- Verify FRONTEND_URL matches your domain
- Check CORS settings in Express (should be open in prod)
- Verify API is publicly accessible

**"Migration failed"**
- Check DATABASE_URL points to correct database
- Verify database user has CREATE/ALTER permissions
- Run manually: `npm run migrate -w @build-empire/api`

### Get Help

- Check logs in deployment platform's dashboard
- Run `npm run smoke` locally to isolate issues
- Review error messages in `apps/api/dist/index.js`

---

## One-Command Quick Deploys

Once setup, deploy with single commands:

```bash
# Render
npm run deploy:render

# Fly.io
npm run deploy:fly

# DigitalOcean
npm run deploy:digitalocean

# AWS
npm run deploy:aws
```

---

## Environment Checklist for Each Platform

### Render
- [ ] GitHub repo connected
- [ ] Build command: `npm run build`
- [ ] Start command: `npm run start:prod`
- [ ] PostgreSQL addon created
- [ ] All env vars set in dashboard

### Fly.io
- [ ] `flyctl` installed and logged in
- [ ] `fly.toml` generated
- [ ] PostgreSQL database provisioned
- [ ] Secrets set with `flyctl secrets set`

### DigitalOcean
- [ ] GitHub connected in DigitalOcean
- [ ] `app.yaml` uploaded
- [ ] Managed PostgreSQL created
- [ ] All env vars set in app.yaml or dashboard

### AWS
- [ ] AWS CLI configured with credentials
- [ ] ECR repository created
- [ ] RDS PostgreSQL instance running
- [ ] ECS cluster + task definition created
- [ ] ALB + target groups configured
- [ ] Security groups allow inbound on 443, 80

---

**Ready to deploy? Pick a platform above and follow the steps!**
