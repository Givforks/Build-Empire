import { Pool, type QueryResultRow } from 'pg';
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

const pool = new Pool({ connectionString: config.DATABASE_URL });

const now = () => new Date().toISOString();

function parseJsonValue<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function rowToChatMessage(row: any): ChatMessage {
  return {
    id: row.id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    body: row.body,
    appointmentId: row.appointment_id || undefined,
    attachments: parseJsonValue(row.attachments, []),
    createdAt: row.created_at,
    deliveredAt: row.delivered_at || undefined,
    readAt: row.read_at || undefined,
  };
}

function rowToUser(row: any): User {
  return {
    id: row.id,
    role: row.role,
    email: row.email || undefined,
    username: row.username || undefined,
    passwordHash: row.password_hash,
    fullName: row.full_name || undefined,
    rank: row.rank || undefined,
    specializations: parseJsonValue<string[]>(row.specializations, []),
    state: row.state || undefined,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

async function query<T extends QueryResultRow = QueryResultRow>(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    const res = await client.query<T>(text, params);
    return res;
  } finally {
    client.release();
  }
}

export const database: any = {
  get snapshot() {
    return undefined as unknown as Database;
  },
  persist() {
    return;
  },
  async reset() {
    await query(
      `TRUNCATE TABLE email_dispatches, ai_outputs, chat_messages, reschedules, appointments, users RESTART IDENTITY CASCADE`
    );
  },
  reload() {
    return;
  },
  async findUserByEmail(email: string) {
    const res = await query<User>(`SELECT * FROM users WHERE lower(email)=lower($1) LIMIT 1`, [
      email,
    ]);
    return res.rows[0];
  },
  async findAdminByUsername(username: string) {
    const res = await query<User>(
      `SELECT * FROM users WHERE role='admin' AND username=$1 LIMIT 1`,
      [username]
    );
    return res.rows[0];
  },
  async findFirstAdmin() {
    const res = await query<User>(`SELECT * FROM users WHERE role='admin' LIMIT 1`);
    return res.rows[0];
  },
  async findSuperusers() {
    const res = await query<User>(`SELECT * FROM users WHERE role='superuser'`);
    return res.rows.map((row: any) => rowToUser(row));
  },
  async listUsers(role?: User['role']) {
    const res = role
      ? await query<any>(`SELECT * FROM users WHERE role=$1 ORDER BY created_at DESC`, [role])
      : await query<any>(`SELECT * FROM users ORDER BY created_at DESC`);
    return res.rows.map((row: any) => rowToUser(row));
  },
  async findUserById(id: string) {
    const res = await query<User>(`SELECT * FROM users WHERE id=$1 LIMIT 1`, [id]);
    return res.rows[0] ? rowToUser(res.rows[0]) : undefined;
  },
  async createUser(payload: Omit<User, 'id' | 'createdAt'>) {
    const id = uuid();
    const createdAt = now();
    let password_hash: string = '';
    if ((payload as any).passwordHash) {
      password_hash = (payload as any).passwordHash as string;
    } else if ((payload as any).password) {
      password_hash = bcrypt.hashSync((payload as any).password as string, 10);
    }
    const specializations = (payload as any).specializations
      ? JSON.stringify((payload as any).specializations)
      : null;
    await query(
      `INSERT INTO users(id, role, email, username, password_hash, full_name, rank, specializations, state, is_active, created_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        id,
        payload.role,
        payload.email || null,
        payload.username || null,
        password_hash,
        payload.fullName || null,
        (payload as any).rank || null,
        specializations,
        (payload as any).state || null,
        (payload as any).isActive ?? true,
        createdAt,
      ]
    );
    const created = await this.findUserById(id);
    return created || ({ ...payload, id, createdAt, passwordHash: password_hash } as User);
  },
  async updateUser(id: string, update: Partial<User>) {
    const existing = await this.findUserById(id);
    if (!existing) return undefined;
    const merged = { ...existing, ...update } as User;
    const specializations = merged.specializations ? JSON.stringify(merged.specializations) : null;
    await query(
      `UPDATE users SET role=$1, email=$2, username=$3, password_hash=$4, full_name=$5, rank=$6, specializations=$7, state=$8, is_active=$9 WHERE id=$10`,
      [
        merged.role,
        merged.email || null,
        merged.username || null,
        merged.passwordHash,
        merged.fullName || null,
        merged.rank || null,
        specializations,
        merged.state || null,
        merged.isActive ?? true,
        id,
      ]
    );
    return merged;
  },
  async deleteUser(id: string) {
    const existing = await this.findUserById(id);
    if (!existing) return undefined;
    await query(`DELETE FROM users WHERE id=$1`, [id]);
    return existing;
  },
  async createAppointment(payload: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>) {
    const id = uuid();
    const createdAt = now();
    const updatedAt = createdAt;
    const preferred_dates = JSON.stringify(payload.preferredDates || []);
    const attachments = JSON.stringify((payload.attachments as any[]) || []);
    await query(
      `INSERT INTO appointments(id, client_id, admin_id, status, topic, preferred_dates, admin_decided_datetime, superuser_id, attachments, summary_email_status, created_at, updated_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        id,
        payload.clientId,
        payload.adminId,
        payload.status,
        payload.topic,
        preferred_dates,
        payload.adminDecidedDateTime || null,
        payload.superuserId || null,
        attachments,
        (payload as any).summaryEmailStatus || 'PENDING',
        createdAt,
        updatedAt,
      ]
    );
    return { ...payload, id, createdAt, updatedAt } as Appointment;
  },
  async updateAppointment(id: string, update: Partial<Appointment>) {
    const existing = await this.findAppointmentById(id);
    if (!existing) return undefined;
    const merged = { ...existing, ...update, updatedAt: now() } as Appointment;
    await query(
      `UPDATE appointments SET client_id=$1, admin_id=$2, status=$3, topic=$4, preferred_dates=$5, admin_decided_datetime=$6, superuser_id=$7, attachments=$8, summary_email_status=$9, updated_at=$10 WHERE id=$11`,
      [
        merged.clientId,
        merged.adminId,
        merged.status,
        merged.topic,
        JSON.stringify(merged.preferredDates || []),
        merged.adminDecidedDateTime || null,
        merged.superuserId || null,
        JSON.stringify((merged.attachments as any[]) || []),
        (merged as any).summaryEmailStatus || null,
        merged.updatedAt,
        id,
      ]
    );
    return merged;
  },
  async findAppointmentById(id: string) {
    const res = await query<any>(`SELECT * FROM appointments WHERE id=$1 LIMIT 1`, [id]);
    const row = res.rows[0];
    if (!row) return undefined;
    return {
      ...row,
      clientId: row.client_id,
      adminId: row.admin_id,
      status: row.status,
      topic: row.topic,
      preferredDates: parseJsonValue(row.preferred_dates, []),
      adminDecidedDateTime: row.admin_decided_datetime,
      superuserId: row.superuser_id,
      attachments: parseJsonValue(row.attachments, []),
      summaryEmailStatus: row.summary_email_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } as Appointment;
  },
  async listAppointmentsForRole(userId: string, role: User['role']) {
    if (role === 'admin') {
      const res = await query<any>(`SELECT * FROM appointments ORDER BY created_at DESC`);
      return res.rows.map(
        (r: any) =>
          ({
            id: r.id,
            clientId: r.client_id,
            adminId: r.admin_id,
            status: r.status,
            topic: r.topic,
            preferredDates: parseJsonValue(r.preferred_dates, []),
            adminDecidedDateTime: r.admin_decided_datetime,
            superuserId: r.superuser_id,
            attachments: parseJsonValue(r.attachments, []),
            summaryEmailStatus: r.summary_email_status,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          }) as Appointment
      );
    }
    if (role === 'superuser') {
      const res = await query<any>(
        `SELECT * FROM appointments WHERE superuser_id=$1 ORDER BY created_at DESC`,
        [userId]
      );
      return res.rows.map(
        (r: any) =>
          ({
            id: r.id,
            clientId: r.client_id,
            adminId: r.admin_id,
            status: r.status,
            topic: r.topic,
            preferredDates: parseJsonValue(r.preferred_dates, []),
            adminDecidedDateTime: r.admin_decided_datetime,
            superuserId: r.superuser_id,
            attachments: parseJsonValue(r.attachments, []),
            summaryEmailStatus: r.summary_email_status,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          }) as Appointment
      );
    }
    const res = await query<any>(
      `SELECT * FROM appointments WHERE client_id=$1 ORDER BY created_at DESC`,
      [userId]
    );
    return res.rows.map(
      (r: any) =>
        ({
          id: r.id,
          clientId: r.client_id,
          adminId: r.admin_id,
          status: r.status,
          topic: r.topic,
          preferredDates: parseJsonValue(r.preferred_dates, []),
          adminDecidedDateTime: r.admin_decided_datetime,
          superuserId: r.superuser_id,
          attachments: parseJsonValue(r.attachments, []),
          summaryEmailStatus: r.summary_email_status,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }) as Appointment
    );
  },
  async createReschedule(payload: Omit<RescheduleRequest, 'id' | 'createdAt'>) {
    const id = uuid();
    const createdAt = now();
    await query(
      `INSERT INTO reschedules(id, appointment_id, client_id, proposed_dates, reason, status, created_at) VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [
        id,
        payload.appointmentId,
        payload.clientId,
        JSON.stringify(payload.proposedDates || []),
        payload.reason || null,
        payload.status,
        createdAt,
      ]
    );
    return { ...payload, id, createdAt } as RescheduleRequest;
  },
  async addChatMessage(payload: Omit<ChatMessage, 'id' | 'createdAt'>) {
    const id = uuid();
    const createdAt = now();
    await query(
      `INSERT INTO chat_messages(id, from_user_id, to_user_id, body, appointment_id, attachments, created_at) VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [
        id,
        payload.fromUserId,
        payload.toUserId,
        payload.body,
        payload.appointmentId || null,
        JSON.stringify(payload.attachments || []),
        createdAt,
      ]
    );
    return { ...payload, attachments: payload.attachments || [], id, createdAt } as ChatMessage;
  },
  async markChatDelivered(messageId: string) {
    const deliveredAt = now();
    const res = await query(`UPDATE chat_messages SET delivered_at=$1 WHERE id=$2 RETURNING *`, [
      deliveredAt,
      messageId,
    ]);
    return res.rows[0] ? rowToChatMessage(res.rows[0]) : undefined;
  },
  async markChatRead(messageId: string, userId: string) {
    const readAt = now();
    const res = await query(
      `UPDATE chat_messages SET read_at=$1 WHERE id=$2 AND to_user_id=$3 RETURNING *`,
      [readAt, messageId, userId]
    );
    return res.rows[0] ? rowToChatMessage(res.rows[0]) : undefined;
  },
  async listInbox(userId: string) {
    const res = await query<ChatMessage>(
      `SELECT * FROM chat_messages WHERE to_user_id=$1 ORDER BY created_at DESC`,
      [userId]
    );
    return res.rows.map((row: any) => rowToChatMessage(row));
  },
  async listUndeliveredMessages(userId: string) {
    const res = await query<ChatMessage>(
      `SELECT * FROM chat_messages WHERE to_user_id=$1 AND delivered_at IS NULL`,
      [userId]
    );
    return res.rows.map((row: any) => rowToChatMessage(row));
  },
  async listThread(userId: string, peerUserId: string) {
    const res = await query<ChatMessage>(
      `SELECT * FROM chat_messages WHERE (from_user_id=$1 AND to_user_id=$2) OR (from_user_id=$2 AND to_user_id=$1) ORDER BY created_at ASC`,
      [userId, peerUserId]
    );
    return res.rows.map((row: any) => rowToChatMessage(row));
  },
  async addAIOutput(entry: Database['aiOutputs'][number]) {
    const id = uuid();
    const createdAt = now();
    await query(
      `INSERT INTO ai_outputs(id, appointment_id, client_id, prompt, summary_text, readme_attachment_id, pdf_attachment_id, created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        id,
        entry.appointmentId,
        entry.clientId,
        entry.prompt,
        entry.summaryText,
        entry.readmeAttachmentId,
        entry.pdfAttachmentId,
        createdAt,
      ]
    );
    return { ...entry, id, createdAt };
  },
  async addEmailDispatch(payload: Omit<EmailDispatch, 'id' | 'createdAt' | 'status'>) {
    const id = uuid();
    const createdAt = now();
    await query(
      `INSERT INTO email_dispatches(id, appointment_id, "to", subject, status, error_message, created_at) VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [id, payload.appointmentId, payload.to, payload.subject, 'PENDING', null, createdAt]
    );
    return { ...payload, id, createdAt, status: 'PENDING' } as EmailDispatch;
  },
  async updateEmailDispatch(id: string, update: Partial<EmailDispatch>) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (update.status !== undefined) {
      fields.push(`status=$${idx++}`);
      values.push(update.status);
    }
    if ((update as any).errorMessage !== undefined) {
      fields.push(`error_message=$${idx++}`);
      values.push((update as any).errorMessage);
    }
    if ((update as any).sentAt !== undefined) {
      fields.push(`sent_at=$${idx++}`);
      values.push((update as any).sentAt);
    }
    if (fields.length === 0) return undefined;
    values.push(id);
    const res = await query(
      `UPDATE email_dispatches SET ${fields.join(', ')} WHERE id=$${idx} RETURNING *`,
      values
    );
    return res.rows[0];
  },
};

export async function initializeSeedData() {
  const admin = await database.findFirstAdmin();
  if (!admin) {
    await database.createUser({
      role: 'admin',
      username: config.ADMIN_USERNAME,
      passwordHash: bcrypt.hashSync(config.ADMIN_PASSWORD, 10) as any,
      fullName: 'Primary Admin',
      isActive: true,
    } as any);
  }

  const superusers = await database.findSuperusers();
  if (!superusers || superusers.length === 0) {
    await database.createUser({
      role: 'superuser',
      email: 'superuser@example.com',
      passwordHash: bcrypt.hashSync('TempSuper123!', 10) as any,
      fullName: 'Senior Meeting Specialist',
      rank: 'Senior Consultant',
      state: 'Lagos',
      specializations: ['AI Strategy', 'Product Leadership'],
      isActive: true,
    } as any);
  }
}

export function attachmentsDir() {
  return config.DATA_DIR_ABS + '/attachments';
}
