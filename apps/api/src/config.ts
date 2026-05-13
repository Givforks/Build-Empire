import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  JWT_SECRET: z.string().default("build-empire-dev-secret"),
  JWT_SECRET_FILE: z.string().optional(),
  JWT_EXPIRES_IN: z.string().default("8h"),
  DATA_DIR: z.string().default("./data"),
  ADMIN_USERNAME: z.string().default("GivenchiCodes"),
  ADMIN_PASSWORD: z.string().default("Givenchi1@@@@@"),
  ADMIN_PASSWORD_FILE: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  AUTO_RUN_MIGRATIONS: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_PASS_FILE: z.string().optional(),
  SMTP_FROM: z.string().default("no-reply@build-empire.local")
  ,
  SENTRY_DSN: z.string().optional()
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

function fromFile(filePath?: string) {
  if (!filePath) return undefined;
  try {
    return fs.readFileSync(filePath, "utf-8").trim();
  } catch {
    return undefined;
  }
}

const jwtSecret = fromFile(parsed.data.JWT_SECRET_FILE) || parsed.data.JWT_SECRET;
const adminPassword = fromFile(parsed.data.ADMIN_PASSWORD_FILE) || parsed.data.ADMIN_PASSWORD;
const smtpPass = fromFile(parsed.data.SMTP_PASS_FILE) || parsed.data.SMTP_PASS;

if (!jwtSecret || jwtSecret.length < 12) {
  throw new Error("JWT secret must be at least 12 characters.");
}

export const config = {
  ...parsed.data,
  JWT_SECRET: jwtSecret,
  ADMIN_PASSWORD: adminPassword,
  SMTP_PASS: smtpPass,
  DATA_DIR_ABS: path.resolve(process.cwd(), parsed.data.DATA_DIR),
  DB_FILE_ABS: path.resolve(process.cwd(), parsed.data.DATA_DIR, "db.json")
};

export type AppConfig = typeof config;
