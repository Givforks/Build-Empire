CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  role VARCHAR(32) NOT NULL,
  email VARCHAR(255),
  username VARCHAR(255),
  password_hash TEXT NOT NULL,
  full_name VARCHAR(255),
  rank VARCHAR(255),
  specializations JSONB,
  state VARCHAR(128),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY,
  client_id UUID NOT NULL,
  admin_id UUID NOT NULL,
  status VARCHAR(64) NOT NULL,
  topic TEXT NOT NULL,
  preferred_dates JSONB NOT NULL,
  admin_decided_datetime TIMESTAMPTZ,
  superuser_id UUID,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary_email_status VARCHAR(16) DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reschedules (
  id UUID PRIMARY KEY,
  appointment_id UUID NOT NULL,
  client_id UUID NOT NULL,
  proposed_dates JSONB NOT NULL,
  reason TEXT,
  status VARCHAR(16) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY,
  from_user_id UUID NOT NULL,
  to_user_id UUID NOT NULL,
  body TEXT NOT NULL,
  appointment_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ai_outputs (
  id UUID PRIMARY KEY,
  appointment_id UUID NOT NULL,
  client_id UUID NOT NULL,
  prompt TEXT NOT NULL,
  summary_text TEXT NOT NULL,
  readme_attachment_id UUID NOT NULL,
  pdf_attachment_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_dispatches (
  id UUID PRIMARY KEY,
  appointment_id UUID NOT NULL,
  "to" VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  status VARCHAR(16) NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);
