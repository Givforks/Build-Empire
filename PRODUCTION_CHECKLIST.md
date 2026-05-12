# Build-Empire Production Checklist

Complete these steps before going live, during deployment, and after launch.

---

## Pre-Deployment (Local Validation)

### Code Quality
- [ ] Run `npm test` - all tests pass
- [ ] Run `npm run build` - builds without errors
- [ ] Run `npm run lint` - no linting errors (if applicable)
- [ ] Review recent git commits for unintended changes
- [ ] All dependencies are pinned to exact versions in package.json

### Environment & Secrets
- [ ] Run `npm run bootstrap:prod` - generates all secrets and certs
- [ ] Verify `.env` file is NOT committed to git
- [ ] Verify `secrets/` directory is in `.gitignore`
- [ ] Verify `infra/certs/` is in `.gitignore`
- [ ] JWT_SECRET is cryptographically random (at least 32 bytes)
- [ ] ADMIN_PASSWORD is strong (12+ chars, mixed case, numbers, symbols)
- [ ] SMTP_PASSWORD is unique and secure (if using email features)

### Database
- [ ] PostgreSQL connection string is correct format
- [ ] Database user has CREATE and ALTER permissions (for migrations)
- [ ] Test connection works: `npm run docker:up:prod` (includes DB)
- [ ] Migration script runs successfully (check logs for `Migration 001 completed`)
- [ ] Dummy data loads without errors

### Docker & Compose
- [ ] `docker compose config` validates without errors
- [ ] `docker compose build` completes successfully
- [ ] `npm run docker:up:prod` starts both API and web services
- [ ] Containers pass health checks (wait 30 seconds, verify no restarts)

### End-to-End Smoke Test
- [ ] Run `npm run smoke` - all tests pass
  - [ ] API health check returns 200
  - [ ] Client signup works
  - [ ] Appointment creation succeeds
  - [ ] AI summary generation produces README + PDF
  - [ ] Attachments saved to disk
- [ ] Manual walkthrough:
  - [ ] Visit http://localhost:3000 (web)
  - [ ] Click "Sign Up" and complete form
  - [ ] Log in and create appointment
  - [ ] Request AI summary and verify it generates
  - [ ] Check attachments directory has files

### Git State
- [ ] Working tree is clean: `git status` shows no uncommitted changes
- [ ] Latest commit is on main branch
- [ ] All changes are committed and pushed to GitHub
- [ ] GitHub CI/CD pipeline passes (green checkmarks on main)

---

## Deployment Configuration (Platform-Specific)

### Environment Variables (All Platforms)
- [ ] `NODE_ENV=production`
- [ ] `PORT=4010`
- [ ] `DATABASE_URL` set and tested
- [ ] `JWT_SECRET` or `JWT_SECRET_FILE` set (use file in production)
- [ ] `ADMIN_USERNAME=GivenchiCodes`
- [ ] `ADMIN_PASSWORD` or `ADMIN_PASSWORD_FILE` set
- [ ] `FRONTEND_URL` matches your domain (e.g., https://myapp.com)
- [ ] `DEEPSEEK_API_KEY` set (or removed if not using AI)
- [ ] `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS_FILE` configured
- [ ] `AUTO_RUN_MIGRATIONS=true`
- [ ] `DATA_DIR=/data` (for persistent file-based storage if needed)

### TLS/HTTPS
- [ ] SSL certificate is valid (not self-signed for production)
- [ ] Certificate is from trusted CA (e.g., Let's Encrypt)
- [ ] Private key is secure and not committed to git
- [ ] HTTPS redirect is enabled (HTTP → HTTPS)
- [ ] SSL/TLS version is 1.2 or higher
- [ ] Certificate renewal automation is in place (certbot for Let's Encrypt)

### Backup & Recovery
- [ ] Database backups are automated (daily minimum)
- [ ] Backup location is separate from app servers
- [ ] Test restore from backup (do this at least once)
- [ ] Git repository is backed up (GitHub is primary, consider secondary)
- [ ] Secrets have documented recovery procedure

### Render.com Specific
- [ ] PostgreSQL addon created and DATABASE_URL copied
- [ ] All 10+ environment variables set in dashboard
- [ ] Build command: `npm run build`
- [ ] Start command: `npm run start:prod`
- [ ] GitHub repo connected
- [ ] Deploy on push is enabled

### Fly.io Specific
- [ ] `flyctl` CLI installed and authenticated
- [ ] App name set in `fly.toml`
- [ ] PostgreSQL database created with `flyctl postgres create`
- [ ] All secrets set with `flyctl secrets set`
- [ ] `fly.toml` has correct region preferences
- [ ] Deployment succeeds: `flyctl deploy`

### DigitalOcean Specific
- [ ] `app.yaml` generated and reviewed
- [ ] GitHub OAuth connected to DigitalOcean
- [ ] Managed PostgreSQL created (note DATABASE_URL)
- [ ] All env vars in `app.yaml` or dashboard
- [ ] Resource spec (CPU, RAM) appropriate for expected load

### AWS Specific
- [ ] ECR repository created for images
- [ ] RDS PostgreSQL database provisioned
- [ ] Security groups allow:
  - [ ] Port 80 (HTTP)
  - [ ] Port 443 (HTTPS)
  - [ ] Port 5432 (database, internal only)
- [ ] ALB created with health check target `/health`
- [ ] Auto Scaling Group configured (min 2, max 4 instances)
- [ ] Route 53 DNS record points to ALB
- [ ] ECS task definition has all env vars and secrets

---

## Initial Deployment

### Pre-Launch (1 hour before)
- [ ] Do final git push to main
- [ ] Verify GitHub Actions CI/CD passed
- [ ] Refresh environment variables one more time
- [ ] Have rollback plan ready
- [ ] Notify team of deployment window

### Launch Steps
1. [ ] Run deployment script for your platform
2. [ ] Monitor logs in real-time
3. [ ] Wait for health check to pass (5-10 minutes typical)
4. [ ] Verify container/instance is running (not in restart loop)
5. [ ] Run post-deployment verification below

### Emergency Contacts
- [ ] Have rollback procedure documented
- [ ] Have platform support contact info ready
- [ ] Have on-call engineer designated

---

## Post-Deployment Verification (Immediately After)

### Connectivity & Access
- [ ] App URL is reachable in browser
- [ ] HTTPS works and certificate shows as valid
- [ ] Health endpoint responds: `curl https://your-app/health`
- [ ] API is accessible: `curl https://your-app/api/health`
- [ ] Frontend loads without errors (check browser console)

### Core Workflow
- [ ] Client signup succeeds
- [ ] Client login works and persists session
- [ ] Admin login works (GivenchiCodes / Givenchi1@@@@@)
- [ ] Client can create appointment
- [ ] Admin sees appointment in queue
- [ ] Admin can forward to superuser
- [ ] Superuser can respond
- [ ] Client sees updated status

### Data Persistence
- [ ] Create appointment → refresh page → appointment still there
- [ ] Send chat message → refresh → message still there
- [ ] Restart API container → data persists

### Real-time Features
- [ ] Socket.IO connection established (check browser console)
- [ ] Chat messages send and receive in real-time
- [ ] Multiple tabs sync (open two browser windows)
- [ ] Offline messages queue and send when reconnected

### Email (if configured)
- [ ] SMTP settings are correct
- [ ] Test email sends without errors
- [ ] Email delivers to inbox (not spam)
- [ ] Email contains appointment summary and attachments

### Logging
- [ ] Logs accessible in platform dashboard
- [ ] No ERROR or WARNING logs flooding the output
- [ ] Request logs show healthy traffic patterns
- [ ] Database queries complete in <100ms typical

### Performance
- [ ] Page load time < 3 seconds
- [ ] API response time < 500ms
- [ ] No 5xx errors in logs
- [ ] CPU usage < 70% on containers
- [ ] Memory usage stable (not growing)

### Security
- [ ] HTTPS is enforced (no mixed content warnings)
- [ ] Security headers present:
  - [ ] `Strict-Transport-Security` (HSTS)
  - [ ] `X-Frame-Options`
  - [ ] `Content-Security-Policy`
  - [ ] `X-Content-Type-Options`
- [ ] CORS is properly configured
- [ ] Admin credentials work (not exposed in logs)
- [ ] Secrets are not visible in environment variables output

---

## Post-Deployment (First 24 Hours)

### Monitoring & Observability
- [ ] Set up error tracking (e.g., Sentry)
- [ ] Set up performance monitoring (e.g., DataDog)
- [ ] Set up log aggregation (platform logs or external)
- [ ] Create alerting rules for:
  - [ ] High error rate (>1% of requests)
  - [ ] High latency (>1000ms)
  - [ ] Database connection failures
  - [ ] Container restarts
  - [ ] Disk usage > 80%

### User Testing
- [ ] Have 3-5 test users complete full workflows
- [ ] Collect feedback on performance and UX
- [ ] Monitor error logs for issues
- [ ] Fix any critical bugs immediately
- [ ] Deploy fixes via normal deployment process

### Data Verification
- [ ] Spot-check database for data integrity
- [ ] Verify no duplicate or corrupted records
- [ ] Check backup completed successfully
- [ ] Verify backup can be restored (test restore)

### Traffic & Load
- [ ] Monitor CPU/memory under real load
- [ ] No spike in error rates
- [ ] Database query performance acceptable
- [ ] No cascading failures or timeout chains

### Logs Review
- [ ] Check for any concerning patterns
- [ ] Verify migrations ran successfully
- [ ] No warnings about deprecated APIs
- [ ] No permission errors or access denials

---

## Ongoing Operations

### Daily
- [ ] Review error logs for anomalies
- [ ] Check uptime monitoring (should be 99.9%+)
- [ ] Verify backup ran successfully

### Weekly
- [ ] Review performance metrics and trends
- [ ] Check for any security warnings
- [ ] Update dependencies if critical patches available
- [ ] Review user feedback channels

### Monthly
- [ ] Run full smoke test in production
- [ ] Test disaster recovery (restore from backup)
- [ ] Review and update documentation
- [ ] Plan any infrastructure upgrades
- [ ] Review cost trends

### Quarterly
- [ ] Full security audit
- [ ] Capacity planning review
- [ ] Major version dependency updates
- [ ] Disaster recovery drill

---

## Incident Response

### If Something Breaks After Deployment

1. **Immediate (0-5 min)**
   - [ ] Stop further deployment activity
   - [ ] Check current logs for errors
   - [ ] Determine if rollback needed
   - [ ] Notify team

2. **Assessment (5-15 min)**
   - [ ] Root cause analysis from logs
   - [ ] Severity: Critical (app down), High (feature broken), Medium (degraded), Low (minor bug)
   - [ ] Decide: Fix forward or rollback

3. **Resolution**
   - [ ] **If rollback**: Redeploy previous working version
   - [ ] **If fix forward**: Create hotfix branch, test locally, deploy
   - [ ] Monitor logs and metrics for recovery

4. **Post-Incident (after stability restored)**
   - [ ] Document what happened
   - [ ] Identify root cause
   - [ ] Update monitoring to catch similar issues
   - [ ] Post-mortem meeting (if critical incident)

### Rollback Procedures
- [ ] Render: Dashboard → Deployments → Previous → Redeploy
- [ ] Fly.io: `flyctl releases list` → `flyctl releases rollback <VERSION>`
- [ ] DigitalOcean: Dashboard → App → Deployments → Previous → Redeploy
- [ ] AWS ECS: Update service to previous task definition version

---

## Sign-Off

**Pre-Launch Sign-Off**
- [ ] Code Review: _________________ Date: _______
- [ ] QA Testing: _________________ Date: _______
- [ ] DevOps/Deployment: __________ Date: _______
- [ ] Product Owner: ______________ Date: _______

**Post-Launch Sign-Off** (24 hours after)
- [ ] Stability Confirmed: _________ Date: _______
- [ ] Monitoring Active: __________ Date: _______
- [ ] No Critical Issues: __________ Date: _______

---

**Deployment completed successfully when all checklist items are marked complete! 🚀**
