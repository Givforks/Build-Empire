# Build-Empire Feature Roadmap

## 🎯 Current Features (v0.1.0)

**Completed:**

- ✅ Client signup/login with preferred dates
- ✅ Admin dashboard with CRUD for clients/superusers
- ✅ Superuser login with dedicated auth path
- ✅ Appointment scheduling and management
- ✅ Appointment forwarding between superusers
- ✅ Decision workflow (APPROVED/REJECTED)
- ✅ Real-time chat via WebSocket
- ✅ File attachments (PDF, images)
- ✅ AI-powered meeting summaries
- ✅ PDF generation
- ✅ Role-based access control (client/admin/superuser)
- ✅ Glassmorphism UI with 3D effects

---

## 🚀 Phase 1: Email Notifications & Reminders

### 1.1 Email Notifications (READY TO IMPLEMENT)

**Current State:** Nodemailer is installed, email service exists

**New Features:**

```typescript
// Email triggers:

// When: Client books appointment
Event.on('appointment.created', async (apt) => {
  await sendEmail(apt.clientId, {
    subject: `Appointment Confirmation: ${apt.topic}`,
    html: `
      <h2>Your appointment has been confirmed!</h2>
      <p>Topic: ${apt.topic}</p>
      <p>Status: Pending superuser review</p>
      <p>We'll notify you once a superuser accepts.</p>
    `,
  });
});

// When: Superuser accepts appointment
Event.on('appointment.approved', async (apt) => {
  await sendEmail(apt.clientId, {
    subject: `Appointment Approved! 🎉`,
    html: `
      <h2>Great news!</h2>
      <p>Superuser ${apt.superuser.fullName} has approved your appointment.</p>
      <p>Scheduled date: ${apt.appointmentDate}</p>
      <p><a href="${config.WEB_ORIGIN}">View details</a></p>
    `,
  });

  // Also notify superuser
  await sendEmail(apt.superuserId, {
    subject: `Appointment Accepted: ${apt.topic}`,
    html: `<p>You've accepted appointment with ${apt.client.fullName}</p>`,
  });
});

// When: Appointment rejected
Event.on('appointment.rejected', async (apt) => {
  await sendEmail(apt.clientId, {
    subject: `Appointment Decision: Changes Requested`,
    html: `
      <p>Your appointment request needs adjustment.</p>
      <p>Please review the feedback and reschedule.</p>
    `,
  });
});

// When: Client sent a message
Event.on('message.sent', async (msg) => {
  const recipient = database.findUserById(msg.toUserId);
  if (recipient?.emailNotifications) {
    await sendEmail(recipient.email, {
      subject: `New message from ${msg.senderName}`,
      html: `<p>${msg.body.substring(0, 100)}...</p><a href="${config.WEB_ORIGIN}">Reply</a>`,
    });
  }
});
```

**Implementation Steps:**

1. Add `User.emailNotifications` boolean field
2. Create `EmailQueue` table to track sent emails
3. Add event emitter to appointment workflow
4. Test with Mailtrap (free testing service)

---

### 1.2 Appointment Reminders

**New Feature:** Automated reminders before scheduled appointments

```typescript
// Runs every hour
async function sendAppointmentReminders() {
  const appointments = database.getAppointmentsInNext(24, 'hours');

  for (const apt of appointments) {
    if (apt.reminderSent) continue; // Skip if already sent

    const hoursUntil = getHoursUntil(apt.appointmentDate);

    if (hoursUntil <= 24 && hoursUntil > 23) {
      // Send 24-hour reminder
      await sendEmail(apt.clientId, {
        subject: `📅 Reminder: Your appointment is tomorrow!`,
        html: `
          <h2>Appointment Reminder</h2>
          <p>Your appointment with ${apt.superuser.fullName} is coming up:</p>
          <p><strong>${format(apt.appointmentDate, "MMM dd, yyyy 'at' h:mm aa")}</strong></p>
          <p><a href="${config.WEB_ORIGIN}/#appointments/${apt.id}">View Details</a></p>
        `,
      });

      database.markReminderSent(apt.id);
    }

    if (hoursUntil <= 1) {
      // Send 1-hour reminder
      await sendEmail(apt.clientId, {
        subject: `⏰ Appointment starting in 1 hour!`,
        html: `<p>Join now at ${config.WEB_ORIGIN}</p>`,
      });
    }
  }
}

// Schedule this to run every hour:
setInterval(sendAppointmentReminders, 60 * 60 * 1000);
```

---

## 📋 Phase 2: Admin Enhancements

### 2.1 Analytics Dashboard

```typescript
// Admin console new tab: "Analytics"

Dashboard shows:
- Total appointments (all-time, this month, this week)
- Conversion rate (approved / total)
- Average time-to-decision
- Superuser performance (approval rate, avg response time)
- Client distribution (by state, by specialization requested)
- Message volume (chat activity)

// API endpoint
GET /api/admin/analytics?period=month
→ Returns aggregated statistics
```

### 2.2 Bulk User Management

```typescript
// Upload CSV to import users:
POST /api/admin/users/import
- Accept CSV file
- Validate email uniqueness
- Bulk create superusers
- Send welcome emails
```

### 2.3 Template Messages

```typescript
// Pre-defined responses for common scenarios:
interface MessageTemplate {
  id: string;
  name: string; // "Schedule Confirmation", "Need More Info", etc.
  body: string;
  tags: string[]; // {{client_name}}, {{date}}, etc.
}

// Use in UI:
// When superuser responds to appointment,
// offer: "Use template" → pick template → auto-fill with values
```

---

## 🔔 Phase 3: Notifications & Real-time

### 3.1 Browser Notifications

```typescript
// Frontend feature: Click to enable notifications
if ('Notification' in window) {
  Notification.requestPermission().then((perm) => {
    if (perm === 'granted') {
      // Show real-time desktop notifications for:
      // - New appointment assigned
      // - New message received
      // - Appointment status changed
    }
  });
}

// When message received:
new Notification('New message from John', {
  body: 'Check your dashboard',
  icon: '/notification-icon.png',
});
```

### 3.2 Notification Preferences

```typescript
interface NotificationPreferences {
  emailOnNewMessage: boolean;
  emailOnAppointmentApproved: boolean;
  emailOnRescheduleRequest: boolean;
  pushNotificationsEnabled: boolean;
  quietHours: { start: '18:00'; end: '09:00' }; // No notifications
}

// User settings page
// Checkbox for each notification type
```

---

## 📊 Phase 4: Reporting & Export

### 4.1 Generate Reports

```typescript
// Admin feature: Export appointments to PDF/Excel
GET /api/admin/reports/appointments?format=pdf&dateFrom=2026-01-01&dateTo=2026-12-31

Returns:
- Appointment summary
- Status breakdown (Approved/Rejected/Pending)
- Revenue (if adding payments)
- Performance metrics
```

### 4.2 User Activity Report

```typescript
GET /api/admin/reports/users/:userId
→ Returns:
  - Login history
  - Appointments scheduled
  - Messages sent/received
  - Last activity timestamp
```

---

## 💳 Phase 5: Monetization (Optional)

### 5.1 Payment Integration

```typescript
// Add Stripe or Paddle
npm install stripe

// When: Client books premium consultation
Event.on("appointment.booked", async (apt) => {
  if (apt.specialization === "premium") {
    const payment = await stripe.paymentIntents.create({
      amount: 9900,  // $99.00
      currency: "usd",
      description: `Appointment with ${apt.superuser.fullName}`
    });

    apt.paymentIntentId = payment.id;
    database.save(apt);
  }
});
```

### 5.2 Invoice Generation

```typescript
// When: Appointment completed
POST /api/invoices
→ Generate PDF invoice with:
  - Service date
  - Superuser name
  - Amount charged
  - Payment status
```

---

## 🔐 Phase 6: Security Enhancements

### 6.1 Two-Factor Authentication (2FA)

```typescript
npm install speakeasy qrcode

POST /api/auth/enable-2fa
→ Returns QR code for Google Authenticator

POST /api/auth/verify-2fa
→ Validates TOTP code during login
```

### 6.2 Audit Trail UI

```typescript
// Admin feature: View all user actions
GET /api/admin/audit-logs?userId=xxx&action=DELETE_USER

Shows:
- Who did what
- When they did it
- What changed
- IP address (for security)
```

---

## 🎨 Phase 7: UX Enhancements

### 7.1 Modal Editors (replace inline forms)

```typescript
// Current: Inline forms in admin panel
// New: Click edit → modal dialog opens with form

// Improvements:
- Better confirmation flow
- Cleaner interface
- Mobile-friendly
- Keyboard shortcuts (Escape to cancel)
```

### 7.2 Advanced Search

```typescript
// Current: List all users/appointments
// New: Full-text search with filters

GET /api/search?q=john&type=users&role=client
→ Returns fuzzy-matched results

// Add filters:
- By date range
- By status
- By superuser assigned
- By topic/specialization
```

### 7.3 Calendar View

```typescript
// New component: Calendar showing:
- All appointments for superuser
- Color-coded by status (pending/approved/rejected)
- Click to view/edit appointment
- Drag to reschedule
```

---

## 📱 Phase 8: Mobile & Progressive Web App

### 8.1 Responsive Design

```typescript
// Current: Works on mobile but not optimized
// New:
- Mobile-first CSS
- Touch-friendly buttons
- Optimized forms
- Bottom navigation for mobile
```

### 8.2 PWA Features

```typescript
// Create service-worker.ts
// Enable:
- Offline mode (read-only access)
- App installation (Add to Home Screen)
- Push notifications
- Installable on iOS/Android
```

---

## ✅ Priority Matrix

| Feature             | Impact     | Effort   | Priority       |
| ------------------- | ---------- | -------- | -------------- |
| Email Notifications | ⭐⭐⭐⭐⭐ | ⭐⭐     | 🔴 **DO NEXT** |
| Reminders           | ⭐⭐⭐⭐   | ⭐⭐     | 🔴 **DO NEXT** |
| Analytics Dashboard | ⭐⭐⭐⭐   | ⭐⭐⭐   | 🟡 Soon        |
| Modal Editors       | ⭐⭐⭐     | ⭐       | 🟡 Soon        |
| 2FA Security        | ⭐⭐⭐⭐   | ⭐⭐⭐⭐ | 🟡 Soon        |
| Payment Integration | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 🟣 Later       |
| PWA Features        | ⭐⭐⭐     | ⭐⭐⭐   | 🟣 Later       |

---

## 🚦 Next Steps

### Week 1: Email & Reminders

- [ ] Add `User.emailNotifications` field to DB
- [ ] Implement email event triggers
- [ ] Add appointment reminder cron job
- [ ] Test with Mailtrap
- [ ] Update frontend with notification preferences

### Week 2: Admin Analytics

- [ ] Create analytics API endpoints
- [ ] Add Analytics tab to admin console
- [ ] Display charts (ApexCharts or Recharts)

### Week 3: Security Hardening

- [ ] Add Helmet.js for security headers
- [ ] Implement stronger password policy
- [ ] Set up audit logging

### Week 4+: Optional Features

- [ ] Modal editors for CRUD
- [ ] Advanced search
- [ ] 2FA implementation

---

**To implement Phase 1 (Email & Reminders), say: "implement email notifications and reminders"**

---

Last Updated: May 13, 2026
