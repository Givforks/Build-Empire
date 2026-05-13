# Build-Empire CI/CD & Production Deployment Guide

## 🚀 Overview

Your Build-Empire project has **automated CI/CD** via GitHub Actions and **multi-platform deployment** options. This guide covers:
- CI/CD pipeline flow
- Production deployment strategies
- Performance optimization
- Security hardening
- Monitoring & troubleshooting

---

## 📊 CI/CD Pipeline Flow

### **Stage 1: Test & Build** (`test-and-build` job)
```
Triggered: On every push to main + pull requests
Node Setup (v20) → Dependencies → Tests (3/3) → Build → Docker Validation
```

**What happens:**
1. ✅ Checkout code at commit
2. ✅ Install 334 npm dependencies via `npm ci` (locked versions)
3. ✅ Run test suite: `npm run test -- --reporter=verbose`
   - Uses Vitest framework
   - Tests both API and database adapters
   - Fails the pipeline if any test fails
4. ✅ Build both workspaces: API (TypeScript → dist/) + Web (Vite → dist/)
5. ✅ Validate Docker Compose configurations
6. ✅ Report build artifact sizes

**Location:** `.github/workflows/ci-cd.yml`

### **Stage 2: Docker Publish** (`docker-publish` job)
```
Triggered: Only on successful push to main (not on PRs)
Build multi-platform images → Push to GHCR (GitHub Container Registry)
```

**What happens:**
1. Sets up Docker Buildx for cross-platform builds (linux/amd64, linux/arm64)
2. Logs into GitHub Container Registry (ghcr.io)
3. Builds and pushes images:
   - `ghcr.io/Givforks/build-empire/api:latest`
   - `ghcr.io/Givforks/build-empire/web:latest`
   - Automatically tags with `:vX.Y.Z` on version tags

**Requirements:**
- `GITHUB_TOKEN` provided automatically
- Dockerfile in `apps/api/` and `apps/web/`

---

## 🎯 Deployment Strategies

### **Option 1: Docker Compose (Local/Single Server)**
**Best for:** Development, small-scale production, testing

```bash
# Development
npm run docker:up

# Production with SSL
npm run docker:up:prod

# Logs
npm run docker:logs

# Stop
npm run docker:down:prod
```

**What it does:**
- Spins up PostgreSQL container
- Runs API and Web containers
- Exposes ports: 3000 (API), 5173 (Web)
- Uses environment variables from `.env.local`

### **Option 2: Render.com (Simple PaaS)**
**Best for:** Quick deployment, free tier available

```bash
npm run deploy:render
```

**Setup:**
1. Create account at render.com
2. Connect GitHub repo
3. Create services from `render.yaml` config
4. Auto-deploy on push to main

**Costs:** Free tier includes 750 hours/month

### **Option 3: Fly.io (Global Edge)**
**Best for:** Global audience, low latency

```bash
npm run deploy:fly
```

**Setup:**
1. Install `fly` CLI
2. Create account at fly.io
3. Run: `fly launch` from project root
4. Deploy: `npm run deploy:fly`

**Costs:** Pay-as-you-go, starting ~$5-10/month

### **Option 4: DigitalOcean App Platform**
**Best for:** Developer-friendly, good performance

```bash
npm run deploy:digitalocean
```

**Setup:**
1. Create account at digitalocean.com
2. Generate API token
3. Set `DIGITALOCEAN_TOKEN` environment variable
4. Run deploy script

**Costs:** Starting ~$12/month

### **Option 5: AWS (EC2 + RDS)**
**Best for:** Enterprise, high traffic, need fine-grained control

```bash
npm run deploy:aws
```

**Setup:**
1. Install AWS CLI: `aws configure`
2. Create EC2 instance (Ubuntu 22.04 LTS)
3. Create RDS PostgreSQL instance
4. Set environment variables
5. Run deploy script

**Costs:** Highly variable, typically $20-100+/month

---

## 🔒 Production Security Checklist

### Before Deployment

- [ ] **Environment Variables**
  ```bash
  # Required in production:
  NODE_ENV=production
  DB_URL=postgresql://user:password@host:5432/build_empire_prod
  JWT_SECRET=<64+ character random string>
  ADMIN_USERNAME=<secure username>
  ADMIN_PASSWORD=<bcrypt hashed password>
  POSTMAN_API_KEY=<if using API integration>
  SMTP_HOST=smtp.gmail.com  # or your email provider
  SMTP_USER=your-email@domain.com
  SMTP_PASSWORD=<app-specific password>
  WEB_ORIGIN=https://yourdomain.com
  ```

- [ ] **Database Security**
  - ✅ Enable PostgreSQL SSL connections
  - ✅ Use strong password (20+ characters, mixed case + numbers)
  - ✅ Restrict database access by IP whitelist
  - ✅ Enable automated backups (daily minimum)
  - ✅ Test backup recovery procedure

- [ ] **Application Security**
  - ✅ Set `NODE_ENV=production`
  - ✅ Enable CORS with specific origin (not `*`)
  - ✅ Rate limiting active on `/api/auth` and `/api/ai` endpoints
  - ✅ JWT expiration set appropriately
  - ✅ Password minimum length enforced (10 chars)
  - ✅ Email validation on signup

- [ ] **Infrastructure**
  - ✅ HTTPS/SSL certificate configured
  - ✅ Firewall allows only needed ports (443, 80)
  - ✅ SSH key-based auth only (no password login)
  - ✅ Automatic security updates enabled
  - ✅ DDoS protection (via Cloudflare or provider)

### Monitoring

```bash
# API health check
curl https://yourdomain.com/api/health

# Expected response:
# {"ok":true,"env":"production","time":"2026-05-13T10:30:00Z"}
```

---

## ⚡ Performance Optimization

### Database Indexes (Recommended)

```sql
-- Create these indexes in PostgreSQL for faster queries:

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_appointments_client_id ON appointments(client_id);
CREATE INDEX idx_appointments_superuser_id ON appointments(superuser_id);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_created_at ON appointments(created_at DESC);
CREATE INDEX idx_chat_messages_from_to ON chat_messages(from_id, to_id);
CREATE INDEX idx_attachments_appointment_id ON attachments(appointment_id);
```

**Why:** Indexes dramatically speed up filtering/sorting (50-100x faster for large tables)

### Caching Strategy

Currently implemented:
- ✅ In-memory rate limiting (express-rate-limit)
- ✅ JWT token caching (verified once per request)

Recommendations for future:
- Add Redis for session caching
- Implement ETags for static content
- Cache appointment lists (invalidate on update)

### Load Testing

```bash
# Using Apache Bench (example for 1000 requests, 10 concurrent)
ab -n 1000 -c 10 https://yourdomain.com/api/health

# Or use Artillery for advanced load testing:
npm install -g artillery
artillery quick --count 100 --num 1000 https://yourdomain.com/api/health
```

---

## 🐛 Troubleshooting

### Pipeline Fails: "npm test"

```
❌ ECONNREFUSED: Cannot connect to database
```

**Solution:**
1. Check PostgreSQL is running: `docker ps | grep postgres`
2. Verify DB_URL in `.env.local` matches running instance
3. Run migrations: `npm run migrate`

### Pipeline Fails: "Docker build"

```
❌ Error: "port 3000 already in use"
```

**Solution:**
1. Kill existing process: `lsof -i :3000` then `kill -9 <PID>`
2. Or change port in `docker-compose.yml`

### API Crashes in Production

```
❌ 500 Internal Server Error
```

**Investigate:**
```bash
# Check Docker logs
docker logs <container-id> --tail=100

# Check process running
docker ps | grep build-empire

# Restart service
docker restart <container-id>
```

### Performance Degradation

**Checklist:**
1. ✅ Check database query times: `EXPLAIN ANALYZE <query>`
2. ✅ Look for missing indexes (see Performance Optimization section)
3. ✅ Monitor rate limits: Check `X-RateLimit-*` response headers
4. ✅ Check memory usage: `docker stats`

---

## 📋 Deployment Checklist

Before going live:

```
Pre-Deployment:
☐ All tests passing (3/3)
☐ Build succeeds with 0 errors
☐ Environment variables set correctly
☐ Database backups enabled
☐ SSL certificate installed
☐ Security headers configured
☐ Rate limits appropriate for traffic
☐ Monitoring/alerts configured
☐ Error tracking setup (e.g., Sentry)

Post-Deployment:
☐ Health check endpoint responds
☐ User signup works end-to-end
☐ Admin login accessible
☐ Email notifications sending
☐ File attachments uploading
☐ WebSocket messages real-time
☐ SSL certificate valid (check with: openssl s_client -connect yourdomain.com:443)
☐ Database backups running
☐ Monitoring alerts firing correctly
```

---

## 🔑 Key Environment Variables Reference

| Variable | Purpose | Example |
|----------|---------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `DB_URL` | PostgreSQL connection | `postgresql://user:pass@host/db` |
| `JWT_SECRET` | Token signing key | `<64+ character random>` |
| `ADMIN_USERNAME` | Admin login user | `GivenchiCodes` |
| `ADMIN_PASSWORD` | Admin hashed password | `$2a$12$...bcrypt...` |
| `WEB_ORIGIN` | Allowed CORS origin | `https://yourdomain.com` |
| `SMTP_HOST` | Email server | `smtp.gmail.com` |
| `SMTP_USER` | Email sender | `noreply@yourdomain.com` |
| `SMTP_PASSWORD` | Email password | `<app password>` |

Generate secure password:
```bash
openssl rand -base64 32
```

Generate bcrypt hash:
```bash
node -e "console.log(require('bcryptjs').hashSync('password', 10))"
```

---

## 📞 Support Resources

- **GitHub Actions Docs:** https://docs.github.com/en/actions
- **Docker Docs:** https://docs.docker.com
- **Render Deploy:** https://render.com/docs
- **Fly.io Deploy:** https://fly.io/docs
- **Express.js Security:** https://expressjs.com/en/advanced/best-practice-security.html
- **OWASP Top 10:** https://owasp.org/www-project-top-ten/

---

**Last Updated:** May 13, 2026 | Build-Empire v0.1.0
