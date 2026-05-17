import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import type {
  Appointment,
  ChatMessage,
  Database,
  EmailDispatch,
  RescheduleRequest,
  User,
} from './types.js';

const { hashSync } = bcrypt;

const now = () => new Date().toISOString();

const emptyDb = (): Database => ({
  users: [],
  appointments: [],
  reschedules: [],
  chatMessages: [],
  aiOutputs: [],
  emailDispatches: [],
});

function ensurePaths() {
  if (!fs.existsSync(config.DATA_DIR_ABS)) {
    fs.mkdirSync(config.DATA_DIR_ABS, { recursive: true });
  }
  const attachmentsDir = path.join(config.DATA_DIR_ABS, 'attachments');
  if (!fs.existsSync(attachmentsDir)) {
    fs.mkdirSync(attachmentsDir, { recursive: true });
  }
}

function readDbFile(): Database {
  ensurePaths();
  if (!fs.existsSync(config.DB_FILE_ABS)) {
    const initial = emptyDb();
    fs.writeFileSync(config.DB_FILE_ABS, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  const raw = fs.readFileSync(config.DB_FILE_ABS, 'utf-8');
  if (!raw.trim()) return emptyDb();
  return JSON.parse(raw) as Database;
}

function writeDbFile(db: Database) {
  ensurePaths();
  fs.writeFileSync(config.DB_FILE_ABS, JSON.stringify(db, null, 2), 'utf-8');
}

let db = readDbFile();

export const database = {
  get snapshot(): Database {
    return db;
  },
  persist() {
    writeDbFile(db);
  },
  reset() {
    db = emptyDb();
    writeDbFile(db);
  },
  reload() {
    db = readDbFile();
  },
  findUserByEmail(email: string) {
    return db.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  },
  findAdminByUsername(username: string) {
    return db.users.find((u) => u.role === 'admin' && u.username === username);
  },
  findFirstAdmin() {
    return db.users.find((u) => u.role === 'admin');
  },
  findSuperusers() {
    return db.users.filter((u) => u.role === 'superuser');
  },
  listUsers(role?: User['role']) {
    return role ? db.users.filter((u) => u.role === role) : db.users;
  },
  findUserById(id: string) {
    return db.users.find((u) => u.id === id);
  },
  createUser(payload: Omit<User, 'id' | 'createdAt'>) {
    const user: User = {
      ...payload,
      id: uuid(),
      createdAt: now(),
    };
    db.users.push(user);
    writeDbFile(db);
    return user;
  },
  updateUser(id: string, update: Partial<User>) {
    const idx = db.users.findIndex((u) => u.id === id);
    if (idx < 0) return undefined;
    db.users[idx] = {
      ...db.users[idx],
      ...update,
    };
    writeDbFile(db);
    return db.users[idx];
  },
  deleteUser(id: string) {
    const idx = db.users.findIndex((u) => u.id === id);
    if (idx < 0) return undefined;
    const [removed] = db.users.splice(idx, 1);
    writeDbFile(db);
    return removed;
  },
  createAppointment(payload: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>) {
    const appointment: Appointment = {
      ...payload,
      id: uuid(),
      createdAt: now(),
      updatedAt: now(),
    };
    db.appointments.push(appointment);
    writeDbFile(db);
    return appointment;
  },
  updateAppointment(id: string, update: Partial<Appointment>) {
    const idx = db.appointments.findIndex((a) => a.id === id);
    if (idx < 0) return undefined;
    db.appointments[idx] = {
      ...db.appointments[idx],
      ...update,
      updatedAt: now(),
    };
    writeDbFile(db);
    return db.appointments[idx];
  },
  findAppointmentById(id: string) {
    return db.appointments.find((a) => a.id === id);
  },
  listAppointmentsForRole(userId: string, role: User['role']) {
    if (role === 'admin') return db.appointments;
    if (role === 'superuser') return db.appointments.filter((a) => a.superuserId === userId);
    return db.appointments.filter((a) => a.clientId === userId);
  },
  createReschedule(payload: Omit<RescheduleRequest, 'id' | 'createdAt'>) {
    const item: RescheduleRequest = {
      ...payload,
      id: uuid(),
      createdAt: now(),
    };
    db.reschedules.push(item);
    writeDbFile(db);
    return item;
  },
  addChatMessage(payload: Omit<ChatMessage, 'id' | 'createdAt'>) {
    const message: ChatMessage = {
      ...payload,
      attachments: payload.attachments || [],
      id: uuid(),
      createdAt: now(),
    };
    db.chatMessages.push(message);
    writeDbFile(db);
    return message;
  },
  markChatDelivered(messageId: string) {
    const msg = db.chatMessages.find((m) => m.id === messageId);
    if (!msg) return undefined;
    msg.deliveredAt = now();
    writeDbFile(db);
    return msg;
  },
  markChatRead(messageId: string, userId: string) {
    const msg = db.chatMessages.find((m) => m.id === messageId && m.toUserId === userId);
    if (!msg) return undefined;
    msg.readAt = now();
    writeDbFile(db);
    return msg;
  },
  listInbox(userId: string) {
    return db.chatMessages
      .filter((m) => m.toUserId === userId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },
  listUndeliveredMessages(userId: string) {
    return db.chatMessages.filter((m) => m.toUserId === userId && !m.deliveredAt);
  },
  listThread(userId: string, peerUserId: string) {
    return db.chatMessages
      .filter(
        (m) =>
          (m.fromUserId === userId && m.toUserId === peerUserId) ||
          (m.fromUserId === peerUserId && m.toUserId === userId)
      )
      .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
  },
  addAIOutput(entry: Database['aiOutputs'][number]) {
    db.aiOutputs.push(entry);
    writeDbFile(db);
    return entry;
  },
  addEmailDispatch(payload: Omit<EmailDispatch, 'id' | 'createdAt' | 'status'>) {
    const item: EmailDispatch = {
      ...payload,
      id: uuid(),
      createdAt: now(),
      status: 'PENDING',
    };
    db.emailDispatches.push(item);
    writeDbFile(db);
    return item;
  },
  updateEmailDispatch(id: string, update: Partial<EmailDispatch>) {
    const item = db.emailDispatches.find((e) => e.id === id);
    if (!item) return undefined;
    Object.assign(item, update);
    writeDbFile(db);
    return item;
  },
};

export function initializeSeedData() {
  const hasAdmin = db.users.some((u) => u.role === 'admin');
  if (!hasAdmin) {
    db.users.push({
      id: uuid(),
      role: 'admin',
      username: config.ADMIN_USERNAME,
      passwordHash: hashSync(config.ADMIN_PASSWORD, 10),
      fullName: 'Primary Admin',
      isActive: true,
      createdAt: now(),
    });
  }

  const hasSuperuser = db.users.some((u) => u.role === 'superuser');
  if (!hasSuperuser) {
    db.users.push({
      id: uuid(),
      role: 'superuser',
      email: 'superuser@example.com',
      passwordHash: hashSync('TempSuper123!', 10),
      fullName: 'Senior Meeting Specialist',
      rank: 'Senior Consultant',
      state: 'Lagos',
      specializations: ['AI Strategy', 'Product Leadership'],
      isActive: true,
      createdAt: now(),
    });
  }

  writeDbFile(db);
}

export function attachmentsDir() {
  ensurePaths();
  return path.join(config.DATA_DIR_ABS, 'attachments');
}
