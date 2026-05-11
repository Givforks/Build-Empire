import { v4 as uuid } from "uuid";
import { hashSync } from "bcryptjs";
import type { Appointment, ChatMessage, RescheduleRequest, User } from "./types.js";

const now = () => new Date().toISOString();

export const store = {
  users: new Map<string, User>(),
  appointments: new Map<string, Appointment>(),
  reschedules: new Map<string, RescheduleRequest>(),
  chatMessages: new Map<string, ChatMessage>()
};

export function seedData() {
  const adminId = uuid();
  const superuserId = uuid();

  store.users.set(adminId, {
    id: adminId,
    role: "admin",
    username: "GivenchiCodes",
    passwordHash: hashSync("Givenchi1@@@@@", 10)
  });

  store.users.set(superuserId, {
    id: superuserId,
    role: "superuser",
    email: "superuser@example.com",
    passwordHash: hashSync("TempSuper123!", 10),
    fullName: "Hidden Superuser",
    rank: "Senior Consultant",
    specializations: ["AI Strategy", "Product Advisory"]
  });
}

export function makeTimestamp() {
  return now();
}