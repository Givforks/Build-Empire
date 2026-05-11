export type Role = "client" | "admin" | "superuser";

export type AppointmentStatus =
  | "REQUESTED"
  | "PENDING_ADMIN_REVIEW"
  | "FORWARDED_TO_SUPERUSER"
  | "APPROVED"
  | "REJECTED";

export interface PreferredDate {
  date: string;
  timeSlots: string[];
}

export interface User {
  id: string;
  role: Role;
  email?: string;
  username?: string;
  passwordHash: string;
  fullName?: string;
  rank?: string;
  specializations?: string[];
}

export interface Appointment {
  id: string;
  clientId: string;
  status: AppointmentStatus;
  topic: string;
  preferredDates: PreferredDate[];
  adminDecidedDateTime?: string;
  superuserId?: string;
  aiReadmePath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RescheduleRequest {
  id: string;
  appointmentId: string;
  clientId: string;
  proposedDates: PreferredDate[];
  reason?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  fromUserId: string;
  toUserId: string;
  body: string;
  appointmentId?: string;
  createdAt: string;
  delivered: boolean;
}