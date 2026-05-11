import nodemailer from "nodemailer";
import { config } from "../config.js";

function makeTransport() {
  if (config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS) {
    return nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS
      }
    });
  }

  return nodemailer.createTransport({
    streamTransport: true,
    newline: "unix",
    buffer: true
  });
}

const transporter = makeTransport();

export async function sendSummaryEmail(input: {
  to: string;
  subject: string;
  text: string;
  attachments?: Array<{ filename: string; path: string }>;
}) {
  const info = await transporter.sendMail({
    from: config.SMTP_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
    attachments: input.attachments
  });

  return info;
}
