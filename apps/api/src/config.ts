import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  JWT_SECRET: z.string().min(12).default("build-empire-dev-secret"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  DATA_DIR: z.string().default("./data"),
  ADMIN_USERNAME: z.string().default("GivenchiCodes"),
  ADMIN_PASSWORD: z.string().default("Givenchi1@@@@@"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default("no-reply@build-empire.local")
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

export const config = {
  ...parsed.data,
  DATA_DIR_ABS: path.resolve(process.cwd(), parsed.data.DATA_DIR),
  DB_FILE_ABS: path.resolve(process.cwd(), parsed.data.DATA_DIR, "db.json")
};

export type AppConfig = typeof config;
