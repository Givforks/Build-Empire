import fs from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import { compareSync, hashSync } from "bcryptjs";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { requireAuth, requireRole, signToken } from "./auth.js";
import { makeTimestamp, seedData, store } from "./store.js";
import type { ChatMessage, PreferredDate, User } from "./types.js";

seedData();

const preferredDateSchema = z.object({
  date: z.string().min(1),
  timeSlots: z.array(z.string().min(1)).min(1)
});

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10),
  fullName: z.string().min(2),
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

const appointmentSchema = z.object({
  topic: z.string().min(10),
  preferredDates: z.array(preferredDateSchema).min(1).max(5)
});

const rescheduleSchema = z.object({
  proposedDates: z.array(preferredDateSchema).min(1).max(5),
  reason: z.string().optional()
});

const aiSchema = z.object({
  appointmentId: z.string().min(1),
  prompt: z.string().min(20)
});

const chatSchema = z.object({
  toUserId: z.string().min(1),
  body: z.string().min(1).max(2000),
  appointmentId: z.string().optional()
});

function findUserByEmail(email: string): User | undefined {
  return [...store.users.values()].find((u) => u.email === email);
}

function findAdminByUsername(username: string): User | undefined {
  return [...store.users.values()].find((u) => u.role === "admin" && u.username === username);
}

function maskSuperuser(superuser?: User) {
  if (!superuser) return null;
  return {
    rank: superuser.rank,
    specializations: superuser.specializations || []
  };
}

function ensureDataDir() {
  const dir = path.resolve(process.cwd(), "apps/api/data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function buildAiReadme(prompt: string) {
  return `# Meeting Brief\n\n## Client Request Summary\n${prompt}\n\n## Recommended Talking Points\n- Clarify primary objective\n- Confirm expected outcomes\n- Align on constraints and timeline\n\n## Suggested Agenda\n1. Problem statement\n2. Desired outcomes\n3. Next steps\n`;
}

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/auth/signup", (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    if (findUserByEmail(parsed.data.email)) {
      return res.status(409).json({ error: "Email already exists" });
    }

    const id = uuid();
    store.users.set(id, {
      id,
      role: "client",
      email: parsed.data.email,
      fullName: parsed.data.fullName,
      passwordHash: hashSync(parsed.data.password, 10)
    });

    const token = signToken({ userId: id, role: "client" });
    return res.status(201).json({ token, userId: id });
  });

  app.post("/api/auth/login", (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const user = findUserByEmail(parsed.data.email);
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

    const admin = findAdminByUsername(parsed.data.username);
    if (!admin || !compareSync(parsed.data.password, admin.passwordHash)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = signToken({ userId: admin.id, role: "admin" });
    return res.json({ token, role: "admin", userId: admin.id });
  });

  app.post("/api/appointments", requireAuth, requireRole("client"), (req, res) => {
    const parsed = appointmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const auth = (req as any).auth;
    const superuser = [...store.users.values()].find((u) => u.role === "superuser");
    const id = uuid();
    const timestamp = makeTimestamp();

    store.appointments.set(id, {
      id,
      clientId: auth.userId,
      status: "PENDING_ADMIN_REVIEW",
      topic: parsed.data.topic,
      preferredDates: parsed.data.preferredDates as PreferredDate[],
      superuserId: superuser?.id,
      createdAt: timestamp,
      updatedAt: timestamp
    });

    return res.status(201).json({ id });
  });

  app.get("/api/appointments", requireAuth, (req, res) => {
    const auth = (req as any).auth;
    const all = [...store.appointments.values()];
    const list = auth.role === "admin" ? all : all.filter((a) => a.clientId === auth.userId);

    const payload = list.map((a) => {
      const superuser = a.superuserId ? store.users.get(a.superuserId) : undefined;
      return {
        ...a,
        superuser: auth.role === "admin"
          ? superuser
          : maskSuperuser(superuser)
      };
    });

    return res.json(payload);
  });

  app.post("/api/appointments/:id/reschedule", requireAuth, requireRole("client"), (req, res) => {
    const parsed = rescheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const appointment = store.appointments.get(req.params.id);
    const auth = (req as any).auth;
    if (!appointment || appointment.clientId !== auth.userId) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    if (appointment.status !== "PENDING_ADMIN_REVIEW") {
      return res.status(409).json({ error: "Reschedule allowed only while pending" });
    }

    const id = uuid();
    store.reschedules.set(id, {
      id,
      appointmentId: appointment.id,
      clientId: auth.userId,
      proposedDates: parsed.data.proposedDates,
      reason: parsed.data.reason,
      status: "PENDING",
      createdAt: makeTimestamp()
    });

    appointment.preferredDates = parsed.data.proposedDates;
    appointment.updatedAt = makeTimestamp();
    store.appointments.set(appointment.id, appointment);

    return res.status(201).json({ rescheduleId: id });
  });

  app.post("/api/admin/appointments/:id/decision", requireAuth, requireRole("admin"), (req, res) => {
    const schema = z.object({
      decision: z.enum(["APPROVED", "REJECTED"]),
      adminDecidedDateTime: z.string().optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const appointment = store.appointments.get(req.params.id);
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });

    appointment.status = parsed.data.decision;
    appointment.adminDecidedDateTime = parsed.data.adminDecidedDateTime;
    appointment.updatedAt = makeTimestamp();
    store.appointments.set(appointment.id, appointment);

    return res.json({ ok: true });
  });

  app.post("/api/ai/deepseek", requireAuth, requireRole("client"), (req, res) => {
    const parsed = aiSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const appointment = store.appointments.get(parsed.data.appointmentId);
    const auth = (req as any).auth;
    if (!appointment || appointment.clientId !== auth.userId) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const content = buildAiReadme(parsed.data.prompt);
    const dir = ensureDataDir();
    const filename = `appointment-${appointment.id}-summary.md`;
    const readmePath = path.join(dir, filename);
    fs.writeFileSync(readmePath, content, "utf-8");

    appointment.aiReadmePath = readmePath;
    appointment.updatedAt = makeTimestamp();
    store.appointments.set(appointment.id, appointment);

    return res.json({
      appointmentId: appointment.id,
      fileName: filename,
      readmePath,
      content
    });
  });

  app.get("/api/inbox", requireAuth, (req, res) => {
    const auth = (req as any).auth;
    const messages = [...store.chatMessages.values()].filter((m) => m.toUserId === auth.userId);
    return res.json(messages);
  });

  app.post("/api/chat/send", requireAuth, (req, res) => {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const auth = (req as any).auth;
    const id = uuid();
    const message: ChatMessage = {
      id,
      fromUserId: auth.userId,
      toUserId: parsed.data.toUserId,
      body: parsed.data.body,
      appointmentId: parsed.data.appointmentId,
      createdAt: makeTimestamp(),
      delivered: false
    };
    store.chatMessages.set(id, message);
    return res.status(201).json(message);
  });

  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, { cors: { origin: "*" } });
  const userSockets = new Map<string, string>();

  io.on("connection", (socket) => {
    socket.on("auth:bind", (userId: string) => {
      userSockets.set(userId, socket.id);
    });

    socket.on("chat:send", (message: ChatMessage) => {
      store.chatMessages.set(message.id, message);
      const targetSocketId = userSockets.get(message.toUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit("chat:message", { ...message, delivered: true });
      }
    });

    socket.on("disconnect", () => {
      for (const [userId, socketId] of userSockets.entries()) {
        if (socketId === socket.id) userSockets.delete(userId);
      }
    });
  });

  return { app, httpServer };
}