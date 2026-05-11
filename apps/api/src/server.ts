import fs from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { compareSync, hashSync } from "bcryptjs";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { requireAuth, requireRole, signToken } from "./auth.js";
import { config } from "./config.js";
import { attachmentsDir, database, initializeSeedData } from "./db.js";
import { buildMeetingSummary } from "./services/ai.js";
import { createPdfFromText } from "./services/pdf.js";
import { sendSummaryEmail } from "./services/email.js";
import type { Attachment, ChatMessage, PreferredDate, Role } from "./types.js";

initializeSeedData();

const preferredDateSchema = z.object({
  date: z.string().min(1),
  timeSlots: z.array(z.string().min(1)).min(1)
});

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10),
  fullName: z.string().min(2),
  state: z.string().optional(),
  preferredDates: z.array(preferredDateSchema).min(1).max(5)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const adminLoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

const createSuperuserSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(10),
  rank: z.string().min(2),
  specializations: z.array(z.string().min(2)).min(1),
  state: z.string().optional()
});

const appointmentSchema = z.object({
  topic: z.string().min(10),
  preferredDates: z.array(preferredDateSchema).min(1).max(5),
  superuserId: z.string().optional()
});

const rescheduleSchema = z.object({
  proposedDates: z.array(preferredDateSchema).min(1).max(5),
  reason: z.string().max(400).optional()
});

const decisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  adminDecidedDateTime: z.string().optional()
});

const forwardSchema = z.object({
  superuserId: z.string().min(1)
});

const superuserResponseSchema = z.object({
  accepted: z.boolean()
});

const aiSchema = z.object({
  appointmentId: z.string().min(1),
  prompt: z.string().min(20)
});

const emailSchema = z.object({
  appointmentId: z.string().min(1),
  superuserId: z.string().min(1),
  message: z.string().max(1000).optional()
});

const chatSchema = z.object({
  toUserId: z.string().min(1),
  body: z.string().min(1).max(2000),
  appointmentId: z.string().optional()
});

function now() {
  return new Date().toISOString();
}

function maskSuperuser(superuser?: { rank?: string; specializations?: string[] }) {
  if (!superuser) return null;
  return {
    rank: superuser.rank,
    specializations: superuser.specializations || []
  };
}

function roleSafeAppointment(appointment: any, role: Role) {
  const superuser = appointment.superuserId ? database.findUserById(appointment.superuserId) : undefined;
  if (role === "admin") {
    return { ...appointment, superuser };
  }
  return {
    ...appointment,
    superuser: maskSuperuser(superuser)
  };
}

function toRelativePath(filePath: string) {
  return path.relative(process.cwd(), filePath);
}

function sanitizeError(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.WEB_ORIGIN === "*" ? true : config.WEB_ORIGIN }));
  app.use(express.json({ limit: "1mb" }));

  app.use(
    "/api/auth",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 80,
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  app.use(
    "/api/ai",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 40,
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  app.get("/health", (_req, res) => {
    res.json({ ok: true, env: config.NODE_ENV, time: now() });
  });

  app.get("/api/me", requireAuth, (req, res) => {
    const auth = (req as any).auth;
    const user = database.findUserById(auth.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({
      id: user.id,
      role: user.role,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      rank: user.rank,
      specializations: user.specializations
    });
  });

  app.post("/api/auth/signup", (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    if (database.findUserByEmail(parsed.data.email)) {
      return res.status(409).json({ error: "Email already exists" });
    }

    const user = database.createUser({
      role: "client",
      email: parsed.data.email,
      fullName: parsed.data.fullName,
      state: parsed.data.state,
      passwordHash: hashSync(parsed.data.password, 10),
      isActive: true
    });

    const token = signToken({ userId: user.id, role: "client" });
    return res.status(201).json({ token, userId: user.id, role: "client" });
  });

  app.post("/api/auth/login", (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const user = database.findUserByEmail(parsed.data.email);
    if (!user || !compareSync(parsed.data.password, user.passwordHash)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = signToken({ userId: user.id, role: user.role });
    return res.json({ token, role: user.role, userId: user.id });
  });

  app.post("/api/auth/admin-login", (req, res) => {
    const parsed = adminLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const admin = database.findAdminByUsername(parsed.data.username);
    if (!admin || !compareSync(parsed.data.password, admin.passwordHash)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = signToken({ userId: admin.id, role: "admin" });
    return res.json({ token, role: "admin", userId: admin.id });
  });

  app.get("/api/admin/superusers", requireAuth, requireRole("admin"), (_req, res) => {
    const superusers = database.findSuperusers();
    return res.json(superusers);
  });

  app.post("/api/admin/superusers", requireAuth, requireRole("admin"), (req, res) => {
    const parsed = createSuperuserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    if (database.findUserByEmail(parsed.data.email)) {
      return res.status(409).json({ error: "Email already exists" });
    }

    const superuser = database.createUser({
      role: "superuser",
      email: parsed.data.email,
      fullName: parsed.data.fullName,
      rank: parsed.data.rank,
      specializations: parsed.data.specializations,
      state: parsed.data.state,
      passwordHash: hashSync(parsed.data.password, 10),
      isActive: true
    });

    return res.status(201).json({
      id: superuser.id,
      fullName: superuser.fullName,
      rank: superuser.rank,
      specializations: superuser.specializations,
      email: superuser.email
    });
  });

  app.post("/api/appointments", requireAuth, requireRole("client"), (req, res) => {
    const parsed = appointmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const auth = (req as any).auth;
    const admin = database.findFirstAdmin();
    if (!admin) {
      return res.status(500).json({ error: "No admin configured" });
    }

    const candidateSuperuser = parsed.data.superuserId
      ? database.findUserById(parsed.data.superuserId)
      : database.findSuperusers()[0];

    const appointment = database.createAppointment({
      clientId: auth.userId,
      adminId: admin.id,
      status: "PENDING_ADMIN_REVIEW",
      topic: parsed.data.topic,
      preferredDates: parsed.data.preferredDates as PreferredDate[],
      superuserId: candidateSuperuser?.id,
      attachments: [],
      summaryEmailStatus: "PENDING"
    });

    return res.status(201).json({ id: appointment.id });
  });

  app.get("/api/appointments", requireAuth, (req, res) => {
    const auth = (req as any).auth;
    const list = database.listAppointmentsForRole(auth.userId, auth.role);
    const payload = list.map((item) => roleSafeAppointment(item, auth.role));
    return res.json(payload);
  });

  app.post("/api/appointments/:id/reschedule", requireAuth, requireRole("client"), (req, res) => {
    const parsed = rescheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const auth = (req as any).auth;
    const appointment = database.findAppointmentById(req.params.id);
    if (!appointment || appointment.clientId !== auth.userId) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    if (appointment.status !== "PENDING_ADMIN_REVIEW") {
      return res.status(409).json({ error: "Reschedule allowed only while pending" });
    }

    const reschedule = database.createReschedule({
      appointmentId: appointment.id,
      clientId: auth.userId,
      proposedDates: parsed.data.proposedDates,
      reason: parsed.data.reason,
      status: "PENDING"
    });

    database.updateAppointment(appointment.id, { preferredDates: parsed.data.proposedDates });

    return res.status(201).json({ rescheduleId: reschedule.id });
  });

  app.post("/api/admin/appointments/:id/forward", requireAuth, requireRole("admin"), (req, res) => {
    const parsed = forwardSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const appointment = database.findAppointmentById(req.params.id);
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });

    const superuser = database.findUserById(parsed.data.superuserId);
    if (!superuser || superuser.role !== "superuser") {
      return res.status(404).json({ error: "Superuser not found" });
    }

    const updated = database.updateAppointment(appointment.id, {
      superuserId: superuser.id,
      status: "FORWARDED_TO_SUPERUSER"
    });

    return res.json({ ok: true, appointment: updated });
  });

  app.post("/api/superuser/appointments/:id/respond", requireAuth, requireRole("superuser"), (req, res) => {
    const parsed = superuserResponseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const auth = (req as any).auth;
    const appointment = database.findAppointmentById(req.params.id);
    if (!appointment || appointment.superuserId !== auth.userId) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const status = parsed.data.accepted ? "SUPERUSER_RESPONDED" : "REJECTED";
    const updated = database.updateAppointment(appointment.id, { status });

    return res.json({ ok: true, appointment: updated });
  });

  app.post("/api/admin/appointments/:id/decision", requireAuth, requireRole("admin"), (req, res) => {
    const parsed = decisionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const appointment = database.findAppointmentById(req.params.id);
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });

    if (parsed.data.decision === "APPROVED" && !parsed.data.adminDecidedDateTime) {
      return res.status(400).json({ error: "adminDecidedDateTime is required for approval" });
    }

    const updated = database.updateAppointment(appointment.id, {
      status: parsed.data.decision,
      adminDecidedDateTime: parsed.data.adminDecidedDateTime
    });

    return res.json({ ok: true, appointment: updated });
  });

  app.post("/api/ai/deepseek", requireAuth, requireRole("client"), async (req, res) => {
    const parsed = aiSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const auth = (req as any).auth;
    const appointment = database.findAppointmentById(parsed.data.appointmentId);
    if (!appointment || appointment.clientId !== auth.userId) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const summaryText = buildMeetingSummary(parsed.data.prompt);
    const fileToken = uuid();
    const dir = attachmentsDir();

    const readmeFileName = `appointment-${appointment.id}-${fileToken}.README.md`;
    const readmePath = path.join(dir, readmeFileName);
    fs.writeFileSync(readmePath, summaryText, "utf-8");

    const pdfFileName = `appointment-${appointment.id}-${fileToken}.summary.pdf`;
    const pdfPath = path.join(dir, pdfFileName);
    await createPdfFromText(pdfPath, "Appointment Meeting Brief", summaryText);

    const readmeAttachment: Attachment = {
      id: uuid(),
      type: "readme",
      fileName: readmeFileName,
      filePath: toRelativePath(readmePath),
      createdAt: now()
    };
    const pdfAttachment: Attachment = {
      id: uuid(),
      type: "pdf",
      fileName: pdfFileName,
      filePath: toRelativePath(pdfPath),
      createdAt: now()
    };

    database.addAIOutput({
      id: uuid(),
      appointmentId: appointment.id,
      clientId: auth.userId,
      prompt: parsed.data.prompt,
      summaryText,
      readmeAttachmentId: readmeAttachment.id,
      pdfAttachmentId: pdfAttachment.id,
      createdAt: now()
    });

    const updated = database.updateAppointment(appointment.id, {
      attachments: [...appointment.attachments, readmeAttachment, pdfAttachment]
    });

    return res.json({
      appointmentId: appointment.id,
      attachments: [readmeAttachment, pdfAttachment],
      content: summaryText,
      appointment: updated
    });
  });

  app.post("/api/admin/appointments/send-summary-email", requireAuth, requireRole("admin"), async (req, res) => {
    const parsed = emailSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const appointment = database.findAppointmentById(parsed.data.appointmentId);
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });

    const superuser = database.findUserById(parsed.data.superuserId);
    if (!superuser || superuser.role !== "superuser" || !superuser.email) {
      return res.status(404).json({ error: "Superuser email not found" });
    }

    const attachments = appointment.attachments
      .filter((a) => a.type === "readme" || a.type === "pdf")
      .map((a) => ({ filename: a.fileName, path: path.resolve(process.cwd(), a.filePath) }));

    const dispatch = database.addEmailDispatch({
      appointmentId: appointment.id,
      to: superuser.email,
      subject: `Appointment Summary: ${appointment.id}`
    });

    try {
      await sendSummaryEmail({
        to: superuser.email,
        subject: `Appointment Summary: ${appointment.id}`,
        text: parsed.data.message || `Please review the attached summary for appointment ${appointment.id}.`,
        attachments
      });

      database.updateEmailDispatch(dispatch.id, { status: "SENT", sentAt: now() });
      database.updateAppointment(appointment.id, { summaryEmailStatus: "SENT" });
      return res.json({ ok: true, dispatchId: dispatch.id });
    } catch (error) {
      database.updateEmailDispatch(dispatch.id, {
        status: "FAILED",
        errorMessage: sanitizeError(error)
      });
      database.updateAppointment(appointment.id, { summaryEmailStatus: "FAILED" });
      return res.status(500).json({ error: "Failed to send email", details: sanitizeError(error) });
    }
  });

  app.get("/api/inbox", requireAuth, (req, res) => {
    const auth = (req as any).auth;
    const messages = database.listInbox(auth.userId);
    const unreadCount = messages.filter((m) => !m.readAt).length;
    return res.json({ unreadCount, messages });
  });

  app.get("/api/chat/thread/:peerUserId", requireAuth, (req, res) => {
    const auth = (req as any).auth;
    const thread = database.listThread(auth.userId, req.params.peerUserId);
    return res.json(thread);
  });

  app.post("/api/chat/send", requireAuth, (req, res) => {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const auth = (req as any).auth;
    const message = database.addChatMessage({
      fromUserId: auth.userId,
      toUserId: parsed.data.toUserId,
      body: parsed.data.body,
      appointmentId: parsed.data.appointmentId
    });

    return res.status(201).json(message);
  });

  app.post("/api/chat/:id/read", requireAuth, (req, res) => {
    const auth = (req as any).auth;
    const updated = database.markChatRead(req.params.id, auth.userId);
    if (!updated) return res.status(404).json({ error: "Message not found" });
    return res.json(updated);
  });

  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: config.WEB_ORIGIN === "*" ? true : config.WEB_ORIGIN }
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

  io.on("connection", (socket) => {
    socket.on("auth:bind", (userId: string) => {
      registerSocket(userId, socket.id);

      const undelivered = database.listUndeliveredMessages(userId);
      for (const msg of undelivered) {
        pushToUser(userId, "chat:message", msg);
        database.markChatDelivered(msg.id);
      }
    });

    socket.on("chat:send", (payload: Omit<ChatMessage, "id" | "createdAt">) => {
      const message = database.addChatMessage(payload);
      const delivered = pushToUser(message.toUserId, "chat:message", message);
      if (delivered) {
        const updated = database.markChatDelivered(message.id);
        pushToUser(message.fromUserId, "chat:delivery", updated || message);
      }
    });

    socket.on("chat:read", (messageId: string, userId: string) => {
      const updated = database.markChatRead(messageId, userId);
      if (updated) {
        pushToUser(updated.fromUserId, "chat:read-receipt", updated);
      }
    });

    socket.on("disconnect", () => {
      unregisterSocket(socket.id);
    });
  });

  return { app, httpServer };
}
