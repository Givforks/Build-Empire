import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/server.js";
describe("Build-Empire API", () => {
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
        expect(aiRes.body.fileName).toContain("summary.md");
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
});
