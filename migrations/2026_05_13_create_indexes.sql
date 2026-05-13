-- Migration: create recommended indexes for Build-Empire
-- Date: 2026-05-13

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(lower(email));
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Appointments indexes
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_superuser_id ON appointments(superuser_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_created_at ON appointments(created_at DESC);

-- Chat & attachments
CREATE INDEX IF NOT EXISTS idx_chat_messages_from_to ON chat_messages(from_user_id, to_user_id);
CREATE INDEX IF NOT EXISTS idx_attachments_appointment_id ON attachments(appointment_id);

-- Email dispatches
CREATE INDEX IF NOT EXISTS idx_email_dispatches_status ON email_dispatches(status);
