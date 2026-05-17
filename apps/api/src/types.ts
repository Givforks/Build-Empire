export type Role = 'client' | 'admin' | 'superuser';

export type AppointmentStatus =
  | 'PENDING_ADMIN_REVIEW'
  | 'FORWARDED_TO_SUPERUSER'
  | 'SUPERUSER_RESPONDED'
  | 'APPROVED'
  | 'REJECTED';

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
  state?: string;
  isActive?: boolean;
  createdAt: string;
}

export interface Attachment {
  id: string;
  type: 'readme' | 'pdf' | 'other';
  fileName: string;
  filePath: string;
  createdAt: string;
}

export interface Appointment {
  id: string;
  clientId: string;
  adminId: string;
  status: AppointmentStatus;
  topic: string;
  preferredDates: PreferredDate[];
  adminDecidedDateTime?: string;
  superuserId?: string;
  attachments: Attachment[];
  summaryEmailStatus?: 'PENDING' | 'SENT' | 'FAILED';
  createdAt: string;
  updatedAt: string;
}

export interface RescheduleRequest {
  id: string;
  appointmentId: string;
  clientId: string;
  proposedDates: PreferredDate[];
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  fromUserId: string;
  toUserId: string;
  body: string;
  appointmentId?: string;
  attachments?: Attachment[];
  createdAt: string;
  deliveredAt?: string;
  readAt?: string;
}

export interface AIOutput {
  id: string;
  appointmentId: string;
  clientId: string;
  prompt: string;
  summaryText: string;
  readmeAttachmentId: string;
  pdfAttachmentId: string;
  createdAt: string;
}

export interface EmailDispatch {
  id: string;
  appointmentId: string;
  to: string;
  subject: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  errorMessage?: string;
  createdAt: string;
  sentAt?: string;
}

export interface Database {
  users: User[];
  appointments: Appointment[];
  reschedules: RescheduleRequest[];
  chatMessages: ChatMessage[];
  aiOutputs: AIOutput[];
  emailDispatches: EmailDispatch[];
}
