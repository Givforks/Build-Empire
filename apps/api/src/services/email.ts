import nodemailer from 'nodemailer';
import { config } from '../config.js';
import type { User, Appointment } from '../types.js';

function makeTransport() {
  if (config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS) {
    return nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      },
    });
  }

  return nodemailer.createTransport({
    streamTransport: true,
    newline: 'unix',
    buffer: true,
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
    attachments: input.attachments,
  });

  return info;
}

/**
 * Send appointment confirmation to client
 */
export async function sendAppointmentConfirmation(client: User, appointment: Appointment) {
  if (!client.email) return;

  const html = `
    <h2>Appointment Confirmation 📅</h2>
    <p>Hi ${client.fullName},</p>
    <p>Your appointment request has been received and is under review.</p>
    <h3>Details:</h3>
    <ul>
      <li><strong>Topic:</strong> ${appointment.topic}</li>
      <li><strong>Status:</strong> Pending Review</li>
      <li><strong>Submitted:</strong> ${new Date(appointment.createdAt).toLocaleDateString()}</li>
    </ul>
    <p>A specialist will review your request and contact you soon.</p>
    <p>Thank you for choosing our service!</p>
  `;

  try {
    await transporter.sendMail({
      from: config.SMTP_FROM,
      to: client.email,
      subject: `Appointment Confirmation - ${appointment.topic}`,
      html,
    });
  } catch (error) {
    console.error('Failed to send appointment confirmation:', error);
  }
}

/**
 * Send approval notification to client
 */
export async function sendAppointmentApproved(
  client: User,
  appointment: Appointment,
  superuser: User
) {
  if (!client.email) return;

  const html = `
    <h2>Great News! 🎉 Your Appointment is Approved</h2>
    <p>Hi ${client.fullName},</p>
    <p><strong>${superuser.fullName}</strong> (${superuser.rank}) has approved your appointment request!</p>
    <h3>Appointment Details:</h3>
    <ul>
      <li><strong>Topic:</strong> ${appointment.topic}</li>
      <li><strong>Specialist:</strong> ${superuser.fullName}</li>
      <li><strong>Specializations:</strong> ${(superuser.specializations || []).join(', ') || 'General'}</li>
    </ul>
    <p>You'll receive follow-up details shortly with meeting information.</p>
    <p><a href="${config.WEB_ORIGIN || 'https://app.example.com'}" style="background:#8b5cf6;color:white;padding:10px 20px;border-radius:5px;text-decoration:none;">View Appointment</a></p>
  `;

  try {
    await transporter.sendMail({
      from: config.SMTP_FROM,
      to: client.email,
      subject: `Appointment Approved! ✓`,
      html,
    });
  } catch (error) {
    console.error('Failed to send approval email:', error);
  }
}

/**
 * Send rejection notification to client
 */
export async function sendAppointmentRejected(client: User, appointment: Appointment) {
  if (!client.email) return;

  const html = `
    <h2>Appointment Status Update</h2>
    <p>Hi ${client.fullName},</p>
    <p>Unfortunately, your appointment request has been reviewed and further information is needed.</p>
    <h3>Appointment:</h3>
    <ul>
      <li><strong>Topic:</strong> ${appointment.topic}</li>
      <li><strong>Status:</strong> Awaiting Rescheduling</li>
    </ul>
    <p>Please log back into your account to reschedule or modify your request.</p>
    <p><a href="${config.WEB_ORIGIN || 'https://app.example.com'}" style="background:#ef4444;color:white;padding:10px 20px;border-radius:5px;text-decoration:none;">Reschedule</a></p>
  `;

  try {
    await transporter.sendMail({
      from: config.SMTP_FROM,
      to: client.email,
      subject: `Appointment Needs Adjustment`,
      html,
    });
  } catch (error) {
    console.error('Failed to send rejection email:', error);
  }
}

/**
 * Send appointment reminder to client (24 hours before)
 */
export async function sendAppointmentReminder(
  client: User,
  appointment: Appointment,
  superuser: User
) {
  if (!client.email) return;

  const html = `
    <h2>Appointment Reminder 📅</h2>
    <p>Hi ${client.fullName},</p>
    <p>Your appointment with <strong>${superuser.fullName}</strong> is happening tomorrow!</p>
    <h3>Quick Info:</h3>
    <ul>
      <li><strong>Topic:</strong> ${appointment.topic}</li>
      <li><strong>Specialist:</strong> ${superuser.fullName}</li>
      <li><strong>Time:</strong> Check your dashboard for exact time</li>
    </ul>
    <p>Please join a few minutes early.</p>
    <p><a href="${config.WEB_ORIGIN || 'https://app.example.com'}" style="background:#0f2a66;color:white;padding:10px 20px;border-radius:5px;text-decoration:none;">Join Now</a></p>
  `;

  try {
    await transporter.sendMail({
      from: config.SMTP_FROM,
      to: client.email,
      subject: `Reminder: Appointment Tomorrow!`,
      html,
    });
  } catch (error) {
    console.error('Failed to send reminder email:', error);
  }
}

/**
 * Send new message notification to recipient
 */
export async function sendMessageNotification(
  recipient: User,
  senderName: string,
  messagePreview: string
) {
  if (!recipient.email) return;

  const html = `
    <h2>New Message 💬</h2>
    <p>Hi ${recipient.fullName},</p>
    <p><strong>${senderName}</strong> sent you a new message:</p>
    <blockquote style="border-left:3px solid #8b5cf6;padding-left:15px;margin:15px 0;">
      ${messagePreview.substring(0, 150)}${messagePreview.length > 150 ? '...' : ''}
    </blockquote>
    <p><a href="${config.WEB_ORIGIN || 'https://app.example.com'}" style="background:#8b5cf6;color:white;padding:10px 20px;border-radius:5px;text-decoration:none;">Reply</a></p>
  `;

  try {
    await transporter.sendMail({
      from: config.SMTP_FROM,
      to: recipient.email,
      subject: `New message from ${senderName}`,
      html,
    });
  } catch (error) {
    console.error('Failed to send message notification:', error);
  }
}
