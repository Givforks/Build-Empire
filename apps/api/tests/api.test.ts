import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/server.js";
import { database, initializeSeedData } from "../src/db.js";

describe("Build-Empire API", () => {
  beforeEach(() => {
    database.reset();
    initializeSeedData();
  });

  it("supports signup/login/create appointment/generate AI summary", async () => {
    const { app } = createApp();

    const signupRes = await request(app).post("/api/auth/signup").send({
      email: "client1@example.com",
      password: "ClientPass123!",
      fullName: "Client One",
      preferredDates: [{ date: "2026-05-30", timeSlots: ["10:00"] }]
    });
    expect(signupRes.status).toBe(201);
    const token = signupRes.body.token;

    const appointmentRes = await request(app)
      .post("/api/appointments")
      .set("Authorization", `Bearer ${token}`)
      .send({
        topic: "I need to discuss product strategy and AI roadmap.",
        preferredDates: [{ date: "2026-06-01", timeSlots: ["11:00"] }]
      });

    expect(appointmentRes.status).toBe(201);
    const appointmentId = appointmentRes.body.id;

    const aiRes = await request(app)
      .post("/api/ai/deepseek")
      .set("Authorization", `Bearer ${token}`)
      .send({
        appointmentId,
        prompt: "I want help with scaling my startup and choosing a go-to-market approach."
      });

    expect(aiRes.status).toBe(200);
    expect(aiRes.body.attachments).toHaveLength(2);
    expect(aiRes.body.content).toContain("Meeting Brief");
  });

  it("allows admin login with default credentials", async () => {
    const { app } = createApp();
    const adminRes = await request(app).post("/api/auth/admin-login").send({
      username: "GivenchiCodes",
      password: "Givenchi1@@@@@"
    });

    expect(adminRes.status).toBe(200);
    expect(adminRes.body.role).toBe("admin");
  });

  it("enforces pending-only reschedule and supports admin superuser creation", async () => {
    const { app } = createApp();

    const clientSignup = await request(app).post("/api/auth/signup").send({
      email: "client2@example.com",
      password: "ClientPass123!",
      fullName: "Client Two",
      preferredDates: [{ date: "2026-07-01", timeSlots: ["10:00"] }]
    });

    const clientToken = clientSignup.body.token;
    const createAppointment = await request(app)
      .post("/api/appointments")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        topic: "Need advisory on expansion planning and execution.",
        preferredDates: [{ date: "2026-07-02", timeSlots: ["11:00"] }]
      });

    const appointmentId = createAppointment.body.id;

    const adminLogin = await request(app).post("/api/auth/admin-login").send({
      username: "GivenchiCodes",
      password: "Givenchi1@@@@@"
    });
    const adminToken = adminLogin.body.token;

    const newSuperuser = await request(app)
      .post("/api/admin/superusers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: "Enterprise Expert",
        email: "enterprise.expert@example.com",
        password: "EnterprisePass123!",
        rank: "Principal Consultant",
        specializations: ["Scale", "Finance"]
      });
    expect(newSuperuser.status).toBe(201);

    const decision = await request(app)
      .post(`/api/admin/appointments/${appointmentId}/decision`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ decision: "APPROVED", adminDecidedDateTime: "2026-07-02T11:00:00Z" });
    expect(decision.status).toBe(200);

    const reschedule = await request(app)
      .post(`/api/appointments/${appointmentId}/reschedule`)
      .set("Authorization", `Bearer ${clientToken}`)
      .send({ proposedDates: [{ date: "2026-07-04", timeSlots: ["14:00"] }] });
    expect(reschedule.status).toBe(409);
  });
});