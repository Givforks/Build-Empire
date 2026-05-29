import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { createServer } from 'node:http';
import * as Sentry from '@sentry/node';
import client from 'prom-client';
import { Server as SocketIOServer } from 'socket.io';
import { requireAuth, requireRole, signToken } from './auth.js';
import { config } from './config.js';
import { attachmentsDir, database, initializeSeedData } from './db.js';
import { buildMeetingBrief } from './services/ai.js';
import { createPdfFromText } from './services/pdf.js';
import {
  sendSummaryEmail,
  sendAppointmentConfirmation,
  sendAppointmentApproved,
  sendAppointmentRejected,
  sendAppointmentReminder,
  // sendMessageNotification (not used)
} from './services/email.js';
import type { Attachment, ChatMessage, PreferredDate, Role } from './types.js';

const { compareSync, hashSync } = bcrypt;

initializeSeedData();

const preferredDateSchema = z.object({
  date: z.string().min(1),
  timeSlots: z.array(z.string().min(1)).min(1),
});

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10),
  fullName: z.string().min(2),
  state: z.string().optional(),
  preferredDates: z.array(preferredDateSchema).min(1).max(5),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const adminLoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const superuserLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const adminUserSchema = z.object({
  role: z.enum(['client', 'superuser']),
  email: z.string().email(),
  password: z.string().min(10),
  fullName: z.string().min(2),
  state: z.string().optional(),
  username: z.string().optional(),
  rank: z.string().optional(),
  specializations: z.array(z.string().min(2)).optional(),
  isActive: z.boolean().optional(),
});

const adminUserUpdateSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(10).optional(),
  fullName: z.string().min(2).optional(),
  state: z.string().optional(),
  username: z.string().optional(),
  rank: z.string().optional(),
  specializations: z.array(z.string().min(2)).optional(),
  isActive: z.boolean().optional(),
});

const createSuperuserSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(10),
  rank: z.string().min(2),
  specializations: z.array(z.string().min(2)).min(1),
  state: z.string().optional(),
});

const appointmentSchema = z.object({
  topic: z.string().min(10),
  preferredDates: z.array(preferredDateSchema).min(1).max(5),
  superuserId: z.string().optional(),
});

const rescheduleSchema = z.object({
  proposedDates: z.array(preferredDateSchema).min(1).max(5),
  reason: z.string().max(400).optional(),
});

const decisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  adminDecidedDateTime: z.string().optional(),
});

const forwardSchema = z.object({
  superuserId: z.string().min(1),
});

const superuserResponseSchema = z.object({
  accepted: z.boolean(),
});

const aiSchema = z.object({
  appointmentId: z.string().min(1),
  prompt: z.string().min(20),
});

const emailSchema = z.object({
  appointmentId: z.string().min(1),
  superuserId: z.string().min(1),
  message: z.string().max(1000).optional(),
});

const chatSchema = z.object({
  toUserId: z.string().min(1),
  body: z.string().min(1).max(2000),
  appointmentId: z.string().optional(),
});

function now() {
  return new Date().toISOString();
}

function maskSuperuser(superuser?: { rank?: string; specializations?: string[] }) {
  if (!superuser) return null;
  return {
    rank: superuser.rank,
    specializations: superuser.specializations || [],
  };
}

function publicUser(user: any) {
  if (!user) return null;
  return {
    id: user.id,
    role: user.role,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    rank: user.rank,
    specializations: user.specializations || [],
    state: user.state,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

  async function roleSafeAppointment(appointment: any, role: Role) {
    const superuser = appointment.superuserId
      ? await Promise.resolve(database.findUserById(appointment.superuserId))
      : undefined;
    if (role === 'admin') {
      return { ...appointment, superuser };
    }
    return {
      ...appointment,
      superuser: maskSuperuser(superuser),
    };
  }

function toRelativePath(filePath: string) {
  return path.relative(process.cwd(), filePath);
}

function sanitizeError(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Unknown error';
}

function getCorsOrigins() {
  if (config.WEB_ORIGIN === '*') return true;
  if (config.WEB_ORIGINS?.length) return config.WEB_ORIGINS;
  return config.WEB_ORIGIN;
}

function getAttachmentFromAppointment(appointment: any, attachmentId: string) {
  return (appointment.attachments || []).find(
    (attachment: Attachment) => attachment.id === attachmentId
  );
}

type BriefPhase = 'pre-approval' | 'post-approval';

async function persistBriefArtifacts(input: {
  appointment: any;
  prompt: string;
  phase: BriefPhase;
  sourceUserId: string;
  recipients: string[];
  superuser?: { fullName?: string; rank?: string; specializations?: string[] };
  pushToUser: (userId: string, event: string, payload: unknown) => void;
}) {
  const summaryText = buildMeetingBrief({
    phase: input.phase,
    prompt: input.prompt,
    appointmentTopic: input.appointment.topic,
    appointmentStatus: input.appointment.status,
    preferredDates: input.appointment.preferredDates,
    superuser: input.superuser,
  });
  const fileToken = uuid();
  const dir = attachmentsDir();
  const phaseToken = input.phase === 'post-approval' ? 'approved' : 'draft';

  const readmeFileName = `appointment-${input.appointment.id}-${phaseToken}-${fileToken}.README.md`;
  const readmePath = path.join(dir, readmeFileName);
  fs.writeFileSync(readmePath, summaryText, 'utf-8');

  const pdfFileName = `appointment-${input.appointment.id}-${phaseToken}-${fileToken}.summary.pdf`;
  const pdfPath = path.join(dir, pdfFileName);
  await createPdfFromText(pdfPath, 'Appointment Meeting Brief', summaryText);

  const readmeAttachment: Attachment = {
    id: uuid(),
    type: 'readme',
    fileName: readmeFileName,
    filePath: toRelativePath(readmePath),
    createdAt: now(),
  };
  const pdfAttachment: Attachment = {
    id: uuid(),
    type: 'pdf',
    fileName: pdfFileName,
    filePath: toRelativePath(pdfPath),
    createdAt: now(),
  };

  database.addAIOutput({
    id: uuid(),
    appointmentId: input.appointment.id,
    clientId: input.appointment.clientId,
    prompt: input.prompt,
    summaryText,
    readmeAttachmentId: readmeAttachment.id,
    pdfAttachmentId: pdfAttachment.id,
    createdAt: now(),
  });

  const updatedAppointment = database.updateAppointment(input.appointment.id, {
    attachments: [...(input.appointment.attachments || []), readmeAttachment, pdfAttachment],
  });

  const attachments = [readmeAttachment, pdfAttachment];
  const messages = input.recipients
    .filter((recipientId) => Boolean(recipientId))
    .map((recipientId) => {
      const message = database.addChatMessage({
        fromUserId: input.sourceUserId,
        toUserId: recipientId,
        body: summaryText,
        appointmentId: input.appointment.id,
        attachments,
      });
      input.pushToUser(recipientId, 'chat:message', message);
      return message;
    });

  return {
    summaryText,
    attachments,
    appointment: updatedAppointment,
    messages,
  };
}

export function createApp() {
  const app = express();
  // Initialize Sentry if DSN present
  if (config.SENTRY_DSN) {
    try {
      Sentry.init({ dsn: config.SENTRY_DSN, environment: config.NODE_ENV });
       
      const handlers: any = (Sentry as any).Handlers || (Sentry as any).handler || null;
      if (handlers && handlers.requestHandler) {
        app.use(handlers.requestHandler());
      }
    } catch (e) {
      console.error('Failed to initialize Sentry:', e);
    }
  }
  // Security headers
  app.use(helmet());

  // Simple access logging to file
  function logRequest(method: string, path: string, status: number, duration: number) {
    try {
      const timestamp = new Date().toISOString();
      const log = `${timestamp} ${method} ${path} ${status} ${duration}ms\n`;
      fs.appendFileSync(path === '/health' ? 'logs/health.log' : 'logs/access.log', log);
    } catch {
      // ignore logging errors
    }
  }

  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      logRequest(req.method, req.path, res.statusCode, Date.now() - start);
    });
    next();
  });
  app.use(cors({ origin: getCorsOrigins() }));
  app.use(express.json({ limit: '1mb' }));

  app.use(
    '/api/auth',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 80,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.use(
    '/api/ai',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 40,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.get('/health', (_req, res) => {
    res.json({ ok: true, env: config.NODE_ENV, time: now() });
  });

  // Expose Prometheus metrics if enabled
  try {
    // Avoid double-registration when tests or multiple app instances run
    try {
      const existing = (client.register.getMetricsAsArray && client.register.getMetricsAsArray()) || [];
      const hasProcessCpu = existing.some((m: any) => m && m.name === 'process_cpu_user_seconds_total');
      if (!hasProcessCpu) {
        client.collectDefaultMetrics();
      }
    } catch (innerErr) {
      // Fall back to attempting to collect metrics; if it fails, outer catch will handle it
      try {
        client.collectDefaultMetrics();
      } catch (err) {
        throw err || innerErr;
      }
    }
    app.get('/metrics', async (_req, res) => {
      try {
        res.set('Content-Type', client.register.contentType);
        res.send(await client.register.metrics());
      } catch {
        res.status(500).send('Failed to collect metrics');
      }
    });
  } catch (e) {
    // prom client may fail in some environments; ignore to keep API running
    console.warn('Prometheus client not initialized:', (e as any)?.message || e);
  }

  // Admin analytics endpoint
  app.get('/api/admin/analytics', requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const users = await database.listUsers();
      const appointments = await database.listAppointmentsForRole(
        (req as any).auth.userId,
        'admin'
      );
      const totalUsers = Array.isArray(users) ? users.length : (await users).length;
      const clientCount = Array.isArray(users)
        ? users.filter((u: any) => u.role === 'client').length
        : (await users).filter((u: any) => u.role === 'client').length;
      const superuserCount = Array.isArray(users)
        ? users.filter((u: any) => u.role === 'superuser').length
        : (await users).filter((u: any) => u.role === 'superuser').length;
      const totalAppointments = Array.isArray(appointments)
        ? appointments.length
        : (await appointments).length;
      const statusCounts: Record<string, number> = {};
      const appts = Array.isArray(appointments) ? appointments : await appointments;
      for (const a of appts) {
        statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
      }

      // average decision time for approved appointments
      const approved = appts.filter(
        (a: any) => a.status === 'APPROVED' && a.adminDecidedDateTime && a.createdAt
      );
      let avgDecisionHours = 0;
      if (approved.length) {
        const totalMs = approved.reduce(
          (sum: number, a: any) =>
            sum + (Date.parse(a.adminDecidedDateTime) - Date.parse(a.createdAt)),
          0
        );
        avgDecisionHours = totalMs / approved.length / (1000 * 60 * 60);
      }

      return res.json({
        totalUsers,
        clientCount,
        superuserCount,
        totalAppointments,
        statusCounts,
        avgDecisionHours: Math.round(avgDecisionHours * 100) / 100,
      });
    } catch (err) {
      console.error('Analytics error:', err);
      return res.status(500).json({ error: 'Failed to compute analytics' });
    }
  });

  app.get('/api/me', requireAuth, async (req, res) => {
    const auth = (req as any).auth;
    const user = await Promise.resolve(database.findUserById(auth.userId));
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({
      id: user.id,
      role: user.role,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      rank: user.rank,
      specializations: user.specializations,
    });
  });

  app.post('/api/auth/signup', async (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    if (await Promise.resolve(database.findUserByEmail(parsed.data.email))) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const user = await Promise.resolve(
      database.createUser({
      role: 'client',
      email: parsed.data.email,
      fullName: parsed.data.fullName,
      state: parsed.data.state,
      passwordHash: hashSync(parsed.data.password, 10),
      isActive: true,
      })
    );

    const token = signToken({ userId: user.id, role: 'client' });
    return res.status(201).json({ token, userId: user.id, role: 'client' });
  });

  const bruteForceProtection = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 6,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many login attempts, try again later',
    skipSuccessfulRequests: true,
  });

  app.post('/api/auth/login', bruteForceProtection, async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const user = await Promise.resolve(database.findUserByEmail(parsed.data.email));
    const storedHash = user ? (user.passwordHash || user.password_hash) : undefined;
    if (!user || typeof storedHash !== 'string' || !compareSync(parsed.data.password, storedHash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken({ userId: user.id, role: user.role });
    return res.json({ token, role: user.role, userId: user.id });
  });

  app.post('/api/auth/admin-login', bruteForceProtection, async (req, res) => {
    const parsed = adminLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const admin = await Promise.resolve(database.findAdminByUsername(parsed.data.username));
    const storedHash = admin ? (admin.passwordHash || admin.password_hash) : undefined;
    if (!admin || typeof storedHash !== 'string' || !compareSync(parsed.data.password, storedHash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken({ userId: admin.id, role: 'admin' });
    return res.json({ token, role: 'admin', userId: admin.id });
  });

  app.post('/api/auth/superuser-login', bruteForceProtection, async (req, res) => {
    const parsed = superuserLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const user = await Promise.resolve(database.findUserByEmail(parsed.data.email));
    const storedHash = user ? (user.passwordHash || user.password_hash) : undefined;
    if (!user || user.role !== 'superuser' || typeof storedHash !== 'string' || !compareSync(parsed.data.password, storedHash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken({ userId: user.id, role: 'superuser' });
    return res.json({ token, role: 'superuser', userId: user.id });
  });

  app.get('/api/admin/users', requireAuth, requireRole('admin'), async (req, res) => {
    const role = typeof req.query.role === 'string' ? req.query.role : undefined;
    const list =
      role === 'client' || role === 'superuser'
        ? await Promise.resolve(database.listUsers(role))
        : await Promise.resolve(database.listUsers());
    return res.json((list as any[]).map((user: any) => publicUser(user)));
  });

  app.post('/api/admin/users', requireAuth, requireRole('admin'), async (req, res) => {
    const parsed = adminUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    if (await Promise.resolve(database.findUserByEmail(parsed.data.email))) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    if (
      parsed.data.role === 'superuser' &&
      (!parsed.data.rank || !parsed.data.specializations?.length)
    ) {
      return res
        .status(400)
        .json({ error: 'rank and specializations are required for superusers' });
    }

    const created = await Promise.resolve(
      database.createUser({
      role: parsed.data.role,
      email: parsed.data.email,
      username: parsed.data.role === 'superuser' ? undefined : parsed.data.username,
      fullName: parsed.data.fullName,
      state: parsed.data.state,
      rank: parsed.data.role === 'superuser' ? parsed.data.rank : undefined,
      specializations: parsed.data.role === 'superuser' ? parsed.data.specializations : undefined,
      passwordHash: hashSync(parsed.data.password, 10),
      isActive: parsed.data.isActive ?? true,
      })
    );

    return res.status(201).json(publicUser(created));
  });

  app.patch('/api/admin/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const parsed = adminUserUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const existing = await Promise.resolve(database.findUserById(req.params.id));
    if (!existing) return res.status(404).json({ error: 'User not found' });
    if (existing.role === 'admin') {
      return res.status(403).json({ error: 'Admin accounts cannot be modified here' });
    }
    const updated = await Promise.resolve(
      database.updateUser(existing.id, {
      email: parsed.data.email ?? existing.email,
      username: parsed.data.username ?? existing.username,
      fullName: parsed.data.fullName ?? existing.fullName,
      state: parsed.data.state ?? existing.state,
      rank: parsed.data.rank ?? existing.rank,
      specializations: parsed.data.specializations ?? existing.specializations,
      isActive: parsed.data.isActive ?? existing.isActive,
      passwordHash: parsed.data.password
        ? hashSync(parsed.data.password, 10)
        : existing.passwordHash,
      } as any)
    );

    return res.json(publicUser(updated));
  });

  app.delete('/api/admin/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const existing = await Promise.resolve(database.findUserById(req.params.id));
    if (!existing) return res.status(404).json({ error: 'User not found' });
    if (existing.role === 'admin') {
      return res.status(403).json({ error: 'Admin accounts cannot be deleted here' });
    }

    const removed = await Promise.resolve(database.deleteUser(existing.id));
    return res.json(publicUser(removed));
  });

  app.get('/api/admin/superusers', requireAuth, requireRole('admin'), async (_req, res) => {
    const superusers = await Promise.resolve(database.findSuperusers());
    return res.json((superusers as any[]).map((user: any) => publicUser(user)));
  });

  app.post('/api/admin/superusers', requireAuth, requireRole('admin'), async (req, res) => {
    const parsed = createSuperuserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    if (await Promise.resolve(database.findUserByEmail(parsed.data.email))) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const superuser = await Promise.resolve(
      database.createUser({
      role: 'superuser',
      email: parsed.data.email,
      fullName: parsed.data.fullName,
      rank: parsed.data.rank,
      specializations: parsed.data.specializations,
      state: parsed.data.state,
      passwordHash: hashSync(parsed.data.password, 10),
      isActive: true,
      })
    );

    return res.status(201).json(publicUser(superuser));
  });

  app.post('/api/appointments', requireAuth, requireRole('client'), async (req, res) => {
    const parsed = appointmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const auth = (req as any).auth;
    const admin = await Promise.resolve(database.findFirstAdmin());
    if (!admin) {
      return res.status(500).json({ error: 'No admin configured' });
    }

    const candidateSuperuser = parsed.data.superuserId
      ? await Promise.resolve(database.findUserById(parsed.data.superuserId))
      : (await Promise.resolve(database.findSuperusers()))[0];

    const appointment = await Promise.resolve(database.createAppointment({
      clientId: auth.userId,
      adminId: admin.id,
      status: 'PENDING_ADMIN_REVIEW',
      topic: parsed.data.topic,
      preferredDates: parsed.data.preferredDates as PreferredDate[],
      superuserId: candidateSuperuser?.id,
      attachments: [],
      summaryEmailStatus: 'PENDING',
    }));

    // Send confirmation email to client
    const client = database.findUserById(auth.userId);
    if (client) {
      try {
        await sendAppointmentConfirmation(client, appointment);
      } catch (error) {
        console.error('Failed to send confirmation email:', error);
      }
    }

    return res.status(201).json({ id: appointment.id });
  });

  app.get('/api/appointments', requireAuth, async (req, res) => {
    try {
      const auth = (req as any).auth;
      const maybe = database.listAppointmentsForRole(auth.userId, auth.role);
      const list = maybe instanceof Promise ? await maybe : maybe;
      const payload = await Promise.all(list.map((item: any) => roleSafeAppointment(item, auth.role)));
      return res.json(payload);
    } catch (err) {
      console.error('Failed listing appointments:', err);
      return res.status(500).json({ error: 'Failed to list appointments' });
    }
  });

  app.post('/api/appointments/:id/reschedule', requireAuth, requireRole('client'), (req, res) => {
    const parsed = rescheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const auth = (req as any).auth;
    const appointment = database.findAppointmentById(req.params.id);
    if (!appointment || appointment.clientId !== auth.userId) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (appointment.status !== 'PENDING_ADMIN_REVIEW') {
      return res.status(409).json({ error: 'Reschedule allowed only while pending' });
    }

    const reschedule = database.createReschedule({
      appointmentId: appointment.id,
      clientId: auth.userId,
      proposedDates: parsed.data.proposedDates,
      reason: parsed.data.reason,
      status: 'PENDING',
    });

    database.updateAppointment(appointment.id, { preferredDates: parsed.data.proposedDates });

    return res.status(201).json({ rescheduleId: reschedule.id });
  });

  app.post('/api/admin/appointments/:id/forward', requireAuth, requireRole('admin'), async (req, res) => {
    const parsed = forwardSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const appointment = await Promise.resolve(database.findAppointmentById(req.params.id));
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });

    const superuser = await Promise.resolve(database.findUserById(parsed.data.superuserId));
    if (!superuser || superuser.role !== 'superuser') {
      return res.status(404).json({ error: 'Superuser not found' });
    }

    const updated = await Promise.resolve(
      database.updateAppointment(appointment.id, {
        superuserId: superuser.id,
        status: 'FORWARDED_TO_SUPERUSER',
      })
    );

    return res.json({ ok: true, appointment: updated });
  });

  app.post(
    '/api/superuser/appointments/:id/respond',
    requireAuth,
    requireRole('superuser'),
    async (req, res) => {
      const parsed = superuserResponseSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }

      const auth = (req as any).auth;
      const appointment = await Promise.resolve(database.findAppointmentById(req.params.id));
      if (!appointment || appointment.superuserId !== auth.userId) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      const status = parsed.data.accepted ? 'SUPERUSER_RESPONDED' : 'REJECTED';
      const updated = await Promise.resolve(database.updateAppointment(appointment.id, { status }));

      return res.json({ ok: true, appointment: updated });
    }
  );

  app.post(
    '/api/admin/appointments/:id/decision',
    requireAuth,
    requireRole('admin'),
    async (req, res) => {
      const parsed = decisionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }

      const appointment = await Promise.resolve(database.findAppointmentById(req.params.id));
      if (!appointment) return res.status(404).json({ error: 'Appointment not found' });

      if (parsed.data.decision === 'APPROVED' && !parsed.data.adminDecidedDateTime) {
        return res.status(400).json({ error: 'adminDecidedDateTime is required for approval' });
      }

      const sourceAdminId = (req as any).auth.userId;
      const resolvedSuperuser = appointment.superuserId
        ? await Promise.resolve(database.findUserById(appointment.superuserId))
        : (await Promise.resolve(database.findSuperusers()))[0];

      const updated = await Promise.resolve(
        database.updateAppointment(appointment.id, {
          status: parsed.data.decision,
          adminDecidedDateTime: parsed.data.adminDecidedDateTime,
          superuserId:
            parsed.data.decision === 'APPROVED'
              ? resolvedSuperuser?.id || appointment.superuserId
              : appointment.superuserId,
        })
      );

      if (!updated) {
        return res.status(500).json({ error: 'Failed to update appointment' });
      }

      if (parsed.data.decision === 'APPROVED') {
        try {
          await persistBriefArtifacts({
            appointment: updated,
            prompt: updated.topic,
            phase: 'post-approval',
            sourceUserId: sourceAdminId,
            recipients: [updated.clientId, resolvedSuperuser?.id || ''],
            superuser: resolvedSuperuser,
            pushToUser,
          });
        } catch (error) {
          console.error('Failed to create approved brief:', error);
        }
      }

      // Send decision email to client
      const client = database.findUserById(appointment.clientId);
      if (client) {
        try {
          if (parsed.data.decision === 'APPROVED') {
            if (resolvedSuperuser) {
              await sendAppointmentApproved(client, updated, resolvedSuperuser);
            }
          } else if (parsed.data.decision === 'REJECTED') {
            await sendAppointmentRejected(client, updated);
          }
        } catch (error) {
          console.error('Failed to send decision email:', error);
        }
      }

      return res.json({ ok: true, appointment: updated });
    }
  );

  app.post('/api/ai/deepseek', requireAuth, requireRole('client'), async (req, res) => {
    const parsed = aiSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const auth = (req as any).auth;
    const appointment = database.findAppointmentById(parsed.data.appointmentId);
    if (!appointment || appointment.clientId !== auth.userId) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const phase: BriefPhase = appointment.status === 'APPROVED' ? 'post-approval' : 'pre-approval';
    const resolvedSuperuser = appointment.superuserId
      ? database.findUserById(appointment.superuserId)
      : database.findSuperusers()[0];
    const delivery = await persistBriefArtifacts({
      appointment,
      prompt: parsed.data.prompt,
      phase,
      sourceUserId: auth.userId,
      recipients:
        phase === 'post-approval' && resolvedSuperuser
          ? [auth.userId, resolvedSuperuser.id]
          : [auth.userId],
      superuser: resolvedSuperuser,
      pushToUser,
    });

    return res.json({
      appointmentId: appointment.id,
      attachments: delivery.attachments,
      content: delivery.summaryText,
      appointment: delivery.appointment,
      phase,
    });
  });

  app.post(
    '/api/admin/appointments/send-summary-email',
    requireAuth,
    requireRole('admin'),
    async (req, res) => {
      const parsed = emailSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }

      const appointment = database.findAppointmentById(parsed.data.appointmentId);
      if (!appointment) return res.status(404).json({ error: 'Appointment not found' });

      const superuser = database.findUserById(parsed.data.superuserId);
      if (!superuser || superuser.role !== 'superuser' || !superuser.email) {
        return res.status(404).json({ error: 'Superuser email not found' });
      }

      const attachments = appointment.attachments
        .filter((a) => a.type === 'readme' || a.type === 'pdf')
        .map((a) => ({ filename: a.fileName, path: path.resolve(process.cwd(), a.filePath) }));

      const dispatch = database.addEmailDispatch({
        appointmentId: appointment.id,
        to: superuser.email,
        subject: `Appointment Summary: ${appointment.id}`,
      });

      try {
        await sendSummaryEmail({
          to: superuser.email,
          subject: `Appointment Summary: ${appointment.id}`,
          text:
            parsed.data.message ||
            `Please review the attached summary for appointment ${appointment.id}.`,
          attachments,
        });

        database.updateEmailDispatch(dispatch.id, { status: 'SENT', sentAt: now() });
        database.updateAppointment(appointment.id, { summaryEmailStatus: 'SENT' });
        return res.json({ ok: true, dispatchId: dispatch.id });
      } catch (error) {
        database.updateEmailDispatch(dispatch.id, {
          status: 'FAILED',
          errorMessage: sanitizeError(error),
        });
        database.updateAppointment(appointment.id, { summaryEmailStatus: 'FAILED' });
        return res
          .status(500)
          .json({ error: 'Failed to send email', details: sanitizeError(error) });
      }
    }
  );

  app.get('/api/inbox', requireAuth, (req, res) => {
    const auth = (req as any).auth;
    const messages = database.listInbox(auth.userId);
    const unreadCount = messages.filter((m) => !m.readAt).length;
    return res.json({ unreadCount, messages });
  });

  app.get('/api/attachments/:appointmentId/:attachmentId', requireAuth, (req, res) => {
    const auth = (req as any).auth;
    const appointment = database.findAppointmentById(req.params.appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const canAccess =
      appointment.clientId === auth.userId ||
      appointment.adminId === auth.userId ||
      appointment.superuserId === auth.userId;
    if (!canAccess) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const attachment = getAttachmentFromAppointment(appointment, req.params.attachmentId);
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const absolutePath = path.resolve(process.cwd(), attachment.filePath);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'Attachment file missing' });
    }

    return res.download(absolutePath, attachment.fileName);
  });

  app.get('/api/chat/thread/:peerUserId', requireAuth, (req, res) => {
    const auth = (req as any).auth;
    const thread = database.listThread(auth.userId, req.params.peerUserId);
    return res.json(thread);
  });

  app.post('/api/chat/send', requireAuth, (req, res) => {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const auth = (req as any).auth;
    const message = database.addChatMessage({
      fromUserId: auth.userId,
      toUserId: parsed.data.toUserId,
      body: parsed.data.body,
      appointmentId: parsed.data.appointmentId,
    });

    return res.status(201).json(message);
  });

  app.post('/api/chat/:id/read', requireAuth, (req, res) => {
    const auth = (req as any).auth;
    const updated = database.markChatRead(req.params.id, auth.userId);
    if (!updated) return res.status(404).json({ error: 'Message not found' });
    return res.json(updated);
  });

  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: getCorsOrigins() },
  });

  const userSockets = new Map<string, Set<string>>();

  const registerSocket = (userId: string, socketId: string) => {
    const existing = userSockets.get(userId) || new Set<string>();
    existing.add(socketId);
    userSockets.set(userId, existing);
  };

  const unregisterSocket = (socketId: string) => {
    for (const [userId, sockets] of userSockets.entries()) {
      if (sockets.has(socketId)) {
        sockets.delete(socketId);
        if (sockets.size === 0) userSockets.delete(userId);
      }
    }
  };

  const pushToUser = (userId: string, event: string, payload: unknown) => {
    const sockets = userSockets.get(userId);
    if (!sockets) return false;
    for (const socketId of sockets) {
      io.to(socketId).emit(event, payload);
    }
    return sockets.size > 0;
  };

  io.on('connection', (socket) => {
    socket.on('auth:bind', async (userId: string) => {
      registerSocket(userId, socket.id);

      const maybeUndelivered = database.listUndeliveredMessages(userId);
      const undelivered = maybeUndelivered instanceof Promise ? await maybeUndelivered : maybeUndelivered;
      for (const msg of undelivered) {
        pushToUser(userId, 'chat:message', msg);
        database.markChatDelivered(msg.id);
      }
    });

    socket.on('chat:send', (payload: Omit<ChatMessage, 'id' | 'createdAt'>) => {
      const message = database.addChatMessage(payload);
      const delivered = pushToUser(message.toUserId, 'chat:message', message);
      if (delivered) {
        const updated = database.markChatDelivered(message.id);
        pushToUser(message.fromUserId, 'chat:delivery', updated || message);
      }
    });

    socket.on('chat:read', (messageId: string, userId: string) => {
      const updated = database.markChatRead(messageId, userId);
      if (updated) {
        pushToUser(updated.fromUserId, 'chat:read-receipt', updated);
      }
    });

    socket.on('disconnect', () => {
      unregisterSocket(socket.id);
    });
  });

  // Appointment reminders scheduler (runs hourly)
  async function runAppointmentReminders() {
    try {
      const admin = await database.findFirstAdmin();
      if (!admin) return;
      const maybe = database.listAppointmentsForRole(admin.id, 'admin');
      const list = maybe instanceof Promise ? await maybe : maybe;
      const nowTs = Date.now();
      for (const apt of list) {
        try {
          const scheduled =
            apt.adminDecidedDateTime ||
            (apt.preferredDates && apt.preferredDates[0] && apt.preferredDates[0].date);
          if (!scheduled) continue;
          const scheduledTs = Date.parse(scheduled);
          if (Number.isNaN(scheduledTs)) continue;
          const hoursUntil = (scheduledTs - nowTs) / (1000 * 60 * 60);
          if (hoursUntil <= 24 && hoursUntil > 0 && apt.summaryEmailStatus !== 'REMINDER_SENT') {
            const client = await (database.findUserById
              ? database.findUserById(apt.clientId)
              : undefined);
            const superuser = apt.superuserId
              ? await (database.findUserById ? database.findUserById(apt.superuserId) : undefined)
              : undefined;
            if (client) {
              try {
                await sendAppointmentReminder(
                  client,
                  apt,
                  superuser || ({ fullName: 'Specialist' } as any)
                );
                // mark reminder sent
                if (database.updateAppointment) {
                  await database.updateAppointment(apt.id, { summaryEmailStatus: 'REMINDER_SENT' });
                }
              } catch (err) {
                console.error('Failed sending reminder for appointment', apt.id, err);
              }
            }
          }
        } catch (e) {
          // per-appointment failure should not stop scheduler
          console.error('Reminder check failed for appointment', apt && apt.id, e);
        }
      }
    } catch (e) {
      console.error('Appointment reminder scheduler error:', e);
    }
  }

  // Run initially, then every hour
  void runAppointmentReminders();
  setInterval(() => void runAppointmentReminders(), 60 * 60 * 1000);

  return { app, httpServer };
}
