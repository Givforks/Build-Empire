# Build-Empire Security Hardening Guide

## 🔒 Current Security Features

Your project currently has:
- ✅ **JWT Authentication** with expiring tokens
- ✅ **bcryptjs Password Hashing** (10 salt rounds)
- ✅ **Express Rate Limiting** on `/api/auth` and `/api/ai`
- ✅ **CORS Protection** with origin validation
- ✅ **Zod Input Validation** on all endpoints
- ✅ **Role-Based Access Control** (RBAC)
- ✅ **Email Validation** on signup

---

## 🛡️ Recommended Enhancements

### 1. Add Helmet.js (Security Headers)

**Install:**
```bash
npm install helmet
```

**Add to `apps/api/src/server.ts` (after imports):**
```typescript
import helmet from "helmet";

export function createApp() {
  const app = express();
  
  // Security headers
  app.use(helmet());
  app.use(helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https:"]
    }
  }));
```

**What it does:**
- Sets `X-Frame-Options: DENY` (prevents clickjacking)
- Sets `X-Content-Type-Options: nosniff` (prevents MIME sniffing)
- Sets `Strict-Transport-Security` (forces HTTPS)
- Removes `X-Powered-By` header

---

### 2. Strengthen Password Policy

**Current:** Minimum 10 characters

**Recommended Enhancement:**
```typescript
const strengthPasswordSchema = z.string()
  .min(12)
  .regex(/[A-Z]/, "Must contain uppercase")
  .regex(/[a-z]/, "Must contain lowercase")
  .regex(/[0-9]/, "Must contain number")
  .regex(/[!@#$%^&*]/, "Must contain special char");
```

---

### 3. Implement Request Logging

**Add to `server.ts`:**
```typescript
import fs from "node:fs";

function logRequest(method: string, path: string, status: number, duration: number) {
  const timestamp = new Date().toISOString();
  const log = `${timestamp} ${method} ${path} ${status} ${duration}ms\n`;
  fs.appendFileSync("logs/access.log", log);
}

// After each response:
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    logRequest(req.method, req.path, res.statusCode, Date.now() - start);
  });
  next();
});
```

---

### 4. Add Brute Force Protection

**Current:** Rate limit on `/api/auth` = 80 requests per 15 min

**Enhanced:**
```typescript
const bruteForceProtection = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,  // 5 attempts per 15 minutes
  skipSuccessfulRequests: true,  // Don't count successful logins
  message: "Too many login attempts, try again later"
});

app.post("/api/auth/login", bruteForceProtection, async (req, res) => {
  // ... login logic
});
```

---

### 5. Implement Admin Activity Audit Log

**Schema:**
```typescript
interface AuditLog {
  id: string;
  adminId: string;
  action: "CREATE_USER" | "UPDATE_USER" | "DELETE_USER" | "VIEW_APPOINTMENTS";
  targetId: string;
  timestamp: string;
  changes?: Record<string, any>;
}
```

**Usage:**
```typescript
function logAdminAction(adminId: string, action: string, targetId: string) {
  const entry = {
    id: uuid(),
    adminId,
    action,
    targetId,
    timestamp: now()
  };
  database.saveAuditLog(entry);
}
```

---

### 6. Database Connection Security

**Recommended for PostgreSQL:**

```typescript
// apps/api/src/db-pg.ts - enhance pool config:

const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 20,  // Max pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  // SSL required in production
  ssl: config.NODE_ENV === "production" ? {
    rejectUnauthorized: true,
    ca: fs.readFileSync("certs/ca.pem", "utf-8")
  } : false
});
```

---

### 7. Implement CSRF Protection

**For form submissions (if adding HTML forms):**
```bash
npm install csurf
```

```typescript
import csrf from "csurf";

const csrfProtection = csrf({ cookie: true });

app.post("/api/admin/users", csrfProtection, async (req, res) => {
  // ... create user
});
```

---

### 8. Content Security & Input Sanitization

**Already in place:**
- ✅ Zod validation on all inputs
- ✅ JSON size limit (1MB)
- ✅ Email format validation

**Additional:** Add sanitization for text fields
```bash
npm install xss
```

```typescript
import xss from "xss";

function sanitizeText(text: string): string {
  return xss(text, {
    whiteList: {},  // Strip all HTML
    stripIgnoredTag: true
  });
}

// Use on user inputs:
const message = sanitizeText(req.body.message);
```

---

### 9. API Key Management (for Postman MCP)

**Current:** API key in `.env.postman`

**Production Recommendation:**
- Store in environment variable only (never in code)
- Use secret rotation every 90 days
- Implement API key versioning:

```typescript
interface APIKey {
  id: string;
  key: string;  // hashed
  name: string;
  createdAt: string;
  lastUsedAt: string;
  isActive: boolean;
}

function validateAPIKey(key: string): APIKey | null {
  const stored = database.findAPIKey(key);
  if (stored && stored.isActive) {
    database.updateAPIKeyLastUsed(stored.id);
    return stored;
  }
  return null;
}
```

---

### 10. Dependency Security

**Run regularly:**
```bash
npm audit
npm audit fix
npm outdated
```

**Recommended: Auto-update with Dependabot**

Create `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    allow:
      - dependency-type: "direct"
      - dependency-type: "indirect"
```

---

## 🚨 Security Response Procedures

### If Breach Suspected

1. **Immediate Actions:**
   ```bash
   # Rotate all secrets
   JWT_SECRET=<new random>
   ADMIN_PASSWORD=<new bcrypt hash>
   
   # Revoke all active tokens
   # (Log out all users)
   ```

2. **Notify Users:**
   - Send email alerting of incident
   - Request password reset
   - Monitor for suspicious activity

3. **Audit:**
   - Review audit logs for compromised accounts
   - Check database access logs
   - Review GitHub Actions logs

### If Data Leaked

1. Immediately rotate database credentials
2. Force password reset for all users
3. Enable 2FA if available
4. File incident report if required by regulations

---

## 📋 Security Audit Checklist

Run monthly:

```
Authentication:
☐ JWT tokens expiring appropriately (not >24h recommended)
☐ Password hashing with bcryptjs (10+ salt rounds)
☐ No passwords in logs or error messages
☐ Session management working correctly

API Security:
☐ Rate limiting active on all auth endpoints
☐ Input validation on all POST/PATCH/DELETE
☐ CORS origin correctly restricted
☐ No sensitive data in error messages

Database:
☐ SSL connections enabled
☐ Credentials rotated (quarterly minimum)
☐ Backups encrypted and tested
☐ Access logs reviewed

Infrastructure:
☐ No debug mode in production
☐ HTTPS certificate valid
☐ Firewall rules correct
☐ SSH keys rotated (annually)
☐ System updates current

Monitoring:
☐ Error tracking enabled (Sentry, etc.)
☐ Anomaly alerts configured
☐ Failed login attempts monitored
☐ Unusual API patterns detected
```

---

## 🔍 Testing Security

### Run Security Scan

```bash
# Using npm audit
npm audit

# Using OWASP Dependency-Check (if installed)
dependency-check --project "Build-Empire" --scan .

# Manual API security test
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"<img src=x>","password":"short","fullName":"x"}'
# Should reject with validation error, not execute
```

### Password Strength Test

```bash
# Verify bcrypt is working
node -e "
const bc = require('bcryptjs');
const pwd = 'TestPassword123!';
const hash = bc.hashSync(pwd, 10);
console.log('Hash:', hash);
console.log('Match:', bc.compareSync(pwd, hash));
"
```

---

## 📚 Resources

- **OWASP Top 10:** https://owasp.org/www-project-top-ten/
- **Express.js Security:** https://expressjs.com/en/advanced/best-practice-security.html
- **Node.js Security:** https://nodejs.org/en/docs/guides/security/
- **CWE Top 25:** https://cwe.mitre.org/top25/
- **Helmet.js:** https://helmetjs.github.io/

---

**Last Updated:** May 13, 2026
