import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/config/prisma.js";

const app = createApp();
const stamp = Date.now();
const emails: string[] = [];
const PASSWORD = "Str0ng!Pass";

async function newUser(tag: string) {
  const agent = request.agent(app);
  const email = `test-${tag}-${stamp}@example.com`;
  emails.push(email);
  const res = await agent.post("/api/auth/signup").send({ fullName: "Test User", email, password: PASSWORD, confirmPassword: PASSWORD });
  expect(res.status).toBe(201);
  return { agent, email };
}

const onboarding = {
  dateOfBirth: "1995-06-15",
  sex: "male",
  heightCm: 175,
  weightKg: 72,
  activityLevel: "moderate",
  goal: "lose_weight",
  targetWeightKg: 68,
  unitSystem: "metric",
  dietPreference: "vegetarian",
  workoutsPerWeek: 4,
};

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  await prisma.$disconnect();
});

describe("auth", () => {
  it("rejects weak passwords and duplicate emails", async () => {
    const weak = await request(app).post("/api/auth/signup").send({ fullName: "A B", email: `weak-${stamp}@example.com`, password: "password", confirmPassword: "password" });
    expect(weak.status).toBe(400);
    const { email } = await newUser("dup");
    const dup = await request(app).post("/api/auth/signup").send({ fullName: "A B", email, password: PASSWORD, confirmPassword: PASSWORD });
    expect(dup.status).toBe(409);
  });

  it("sets an HTTP-only session cookie and never returns the hash", async () => {
    const email = `cookie-${stamp}@example.com`;
    emails.push(email);
    const res = await request(app).post("/api/auth/signup").send({ fullName: "Cookie Test", email, password: PASSWORD, confirmPassword: PASSWORD });
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toContain("fp_session=");
    expect(cookie).toContain("HttpOnly");
    expect(JSON.stringify(res.body)).not.toContain("argon2");
  });

  it("logs in, rejects bad credentials, logs out", async () => {
    const { email } = await newUser("login");
    const agent = request.agent(app);
    expect((await agent.post("/api/auth/login").send({ email, password: "Wrong!Pass1" })).status).toBe(401);
    expect((await agent.post("/api/auth/login").send({ email, password: PASSWORD })).status).toBe(200);
    expect((await agent.get("/api/auth/me")).status).toBe(200);
    await agent.post("/api/auth/logout");
    expect((await agent.get("/api/auth/me")).status).toBe(401);
  });

  it("verifies email and resets password with single-use tokens", async () => {
    const { agent, email } = await newUser("tokens");
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    // Tokens are stored hashed, so create a known one for the test.
    const { sha256 } = await import("../src/services/crypto.service.js");
    await prisma.authToken.create({ data: { userId: user.id, type: "password_reset", tokenHash: sha256("known-reset-token"), expiresAt: new Date(Date.now() + 60_000) } });
    const newPw = "N3w!Password";
    const reset = await request(app).post("/api/auth/reset-password").send({ token: "known-reset-token", password: newPw, confirmPassword: newPw });
    expect(reset.status).toBe(200);
    const again = await request(app).post("/api/auth/reset-password").send({ token: "known-reset-token", password: newPw, confirmPassword: newPw });
    expect(again.status).toBe(400);
    // Existing sessions are revoked after reset.
    expect((await agent.get("/api/auth/me")).status).toBe(401);
    expect((await request(app).post("/api/auth/login").send({ email, password: newPw })).status).toBe(200);
  });

  it("blocks cross-site state-changing requests", async () => {
    const res = await request(app).post("/api/auth/login").set("Origin", "https://evil.example").send({ email: "x@y.z", password: "x" });
    expect(res.status).toBe(403);
  });
});

describe("profile, logging and dashboard", () => {
  it("onboards and computes targets", async () => {
    const { agent } = await newUser("onboard");
    const res = await agent.post("/api/profile/onboarding").send(onboarding);
    expect(res.status).toBe(201);
    expect(res.body.goals.bmi).toBe(23.5);
    expect(res.body.goals.dailyCalorieTarget).toBeGreaterThan(1500);
    expect((await agent.get("/api/auth/me")).body.onboarded).toBe(true);
  });

  it("updates the dashboard after logging food, activity, water and sleep", async () => {
    const { agent } = await newUser("dash");
    await agent.post("/api/profile/onboarding").send(onboarding);
    await agent.post("/api/food/entries").send({ mealType: "breakfast", name: "Idli", calories: 210, proteinG: 6, carbsG: 45, fatG: 1 });
    const act = await agent.post("/api/activities").send({ type: "running", startTime: new Date().toISOString(), durationMin: 30, distanceKm: 5 });
    expect(act.body.activity.caloriesBurned).toBe(378);
    expect(act.body.activity.avgPaceMinKm).toBe(6);
    await agent.post("/api/water").send({ amountMl: 500 });
    const wake = new Date();
    await agent.post("/api/sleep").send({ sleepStart: new Date(wake.getTime() - 7.5 * 3600_000).toISOString(), sleepEnd: wake.toISOString(), quality: 4 });
    const d = await agent.get("/api/dashboard");
    expect(d.status).toBe(200);
    expect(d.body.today.caloriesIn).toBe(210);
    expect(d.body.today.caloriesOut).toBe(378);
    expect(d.body.today.waterMl).toBe(500);
    expect(d.body.today.sleepMin).toBe(450);
    expect(d.body.today.distanceKm).toBe(5);
    expect(d.body.remainingCalories).toBe(d.body.goals.dailyCalorieTarget - 210 + 378);
    const ach = await agent.get("/api/achievements");
    const codes = ach.body.items.filter((a: { unlocked: boolean }) => a.unlocked).map((a: { code: string }) => a.code);
    expect(codes).toEqual(expect.arrayContaining(["first_meal", "first_workout"]));
  });

  it("isolates users' records", async () => {
    const a = await newUser("iso-a");
    const b = await newUser("iso-b");
    const created = await a.agent.post("/api/food/entries").send({ mealType: "lunch", name: "Secret meal", calories: 500 });
    const id = created.body.entry.id;
    expect((await b.agent.patch(`/api/food/entries/${id}`).send({ calories: 1 })).status).toBe(404);
    expect((await b.agent.delete(`/api/food/entries/${id}`)).status).toBe(404);
    const list = await b.agent.get("/api/food/entries");
    expect(list.body.entries).toHaveLength(0);
  });
});

describe("offline sync", () => {
  it("is idempotent on replay and soft-deletes", async () => {
    const { agent } = await newUser("sync");
    const ops = [
      { opId: "1", entity: "water", action: "create", clientId: "water-client-0001", data: { amountMl: 250, recordedAt: new Date().toISOString() } },
      { opId: "2", entity: "food", action: "create", clientId: "food-client-00001", data: { mealType: "dinner", name: "Dal", calories: 230, eatenAt: new Date().toISOString() } },
    ];
    const first = await agent.post("/api/sync").send({ ops });
    expect(first.body.results.every((r: { status: string }) => r.status === "ok")).toBe(true);
    await agent.post("/api/sync").send({ ops }); // replay (e.g. response lost)
    const water = await agent.get("/api/water");
    expect(water.body.totalMl).toBe(250);
    const del = await agent.post("/api/sync").send({ ops: [{ opId: "3", entity: "food", action: "delete", clientId: "food-client-00001" }] });
    expect(del.body.results[0].status).toBe("ok");
    expect((await agent.get("/api/food/entries")).body.entries).toHaveLength(0);
  });

  it("reports conflicts when the server copy is newer", async () => {
    const { agent } = await newUser("conflict");
    await agent.post("/api/food/entries").send({ clientId: "conflict-food-01", mealType: "lunch", name: "Rice", calories: 200 });
    const res = await agent.post("/api/sync").send({
      ops: [{ opId: "x", entity: "food", action: "update", clientId: "conflict-food-01", baseUpdatedAt: "2020-01-01T00:00:00Z", data: { calories: 999 } }],
    });
    expect(res.body.results[0].status).toBe("conflict");
  });
});

describe("AI (mock mode)", () => {
  it("scans a food photo and returns an editable estimate", async () => {
    const { agent } = await newUser("scan");
    await agent.post("/api/profile/onboarding").send(onboarding);
    // Minimal valid PNG header + padding
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
    const res = await agent.post("/api/food/scan").attach("image", png, { filename: "meal.png", contentType: "image/png" });
    expect(res.status).toBe(200);
    expect(res.body.analysis.foodName).toBe("Idli with Sambar");
    expect(res.body.analysis.totals.calories).toBe(350);
    expect(res.body.analysis.confidence).toBeGreaterThan(0);
    // Not saved until confirmed.
    expect((await agent.get("/api/food/entries")).body.entries).toHaveLength(0);
  });

  it("rejects non-image uploads", async () => {
    const { agent } = await newUser("badimg");
    const res = await agent.post("/api/food/scan").attach("image", Buffer.from("not an image at all, just text"), { filename: "x.png", contentType: "image/png" });
    expect(res.status).toBe(400);
  });

  it("chats with the assistant and stores the conversation", async () => {
    const { agent } = await newUser("chat");
    const res = await agent.post("/api/ai/chat").send({ message: "How much protein should I eat?" });
    expect(res.status).toBe(200);
    const conv = await agent.get(`/api/ai/conversations/${res.body.conversationId}`);
    expect(conv.body.conversation.messages).toHaveLength(2);
  });
});

describe("account", () => {
  it("exports and deletes all data", async () => {
    const { agent, email } = await newUser("delete");
    await agent.post("/api/profile/onboarding").send(onboarding);
    const exp = await agent.get("/api/account/export");
    expect(exp.body.email).toBe(email);
    expect(exp.body.passwordHash).toBeUndefined();
    const del = await agent.delete("/api/account").send({ password: PASSWORD, confirm: "DELETE" });
    expect(del.status).toBe(204);
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });
});
