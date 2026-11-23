import type { Request, Response } from "express";
import argon2 from "argon2";
import { prisma } from "../config/prisma.js";
import { parse } from "../middleware/validate.js";
import { uid } from "../middleware/auth.js";
import {
  changePasswordSchema,
  deleteAccountSchema,
  forgotSchema,
  loginSchema,
  resetSchema,
  signupSchema,
  tokenSchema,
} from "../validators/auth.validators.js";
import { badRequest, conflict, unauthorized } from "../utils/errors.js";
import { randomToken, sha256 } from "../services/crypto.service.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "../services/email.service.js";
import { SESSION_COOKIE, createSession, destroySession } from "../services/session.service.js";
import { deleteUserImages } from "../services/storage.service.js";

const ARGON = { type: argon2.argon2id as 2, memoryCost: 19456, timeCost: 2, parallelism: 1 };
// Used to equalise timing when the email does not exist (prevents user enumeration by timing).
const DUMMY_HASH = await argon2.hash("timing-equaliser-password", ARGON);

export const publicUser = (u: { id: string; email: string; fullName: string; emailVerifiedAt: Date | null; createdAt: Date }) => ({
  id: u.id,
  email: u.email,
  fullName: u.fullName,
  emailVerified: Boolean(u.emailVerifiedAt),
  createdAt: u.createdAt,
});

async function issueToken(userId: string, type: "email_verification" | "password_reset", ttlMs: number) {
  const token = randomToken(32);
  await prisma.authToken.deleteMany({ where: { userId, type, usedAt: null } });
  await prisma.authToken.create({ data: { userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMs) } });
  return token;
}

async function consumeToken(token: string, type: "email_verification" | "password_reset") {
  const row = await prisma.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.type !== type || row.usedAt || row.expiresAt < new Date()) {
    throw badRequest("This link is invalid or has expired.");
  }
  await prisma.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return row.userId;
}

export async function signup(req: Request, res: Response) {
  const d = parse(signupSchema, req.body);
  if (await prisma.user.findUnique({ where: { email: d.email } })) {
    throw conflict("An account with this email already exists.");
  }
  const user = await prisma.user.create({
    data: {
      email: d.email,
      fullName: d.fullName,
      passwordHash: await argon2.hash(d.password, ARGON),
      notificationPreferences: { create: {} },
    },
  });
  const token = await issueToken(user.id, "email_verification", 48 * 3_600_000);
  await sendVerificationEmail(user.email, user.fullName, token);
  await createSession(res, user.id, req.header("user-agent"));
  res.status(201).json({ user: publicUser(user), onboarded: false });
}

export async function login(req: Request, res: Response) {
  const d = parse(loginSchema, req.body);
  const user = await prisma.user.findUnique({ where: { email: d.email }, include: { profile: { select: { id: true } } } });
  const ok = await argon2.verify(user?.passwordHash ?? DUMMY_HASH, d.password);
  if (!user || !ok) throw unauthorized("Incorrect email or password.");
  await createSession(res, user.id, req.header("user-agent"));
  res.json({ user: publicUser(user), onboarded: Boolean(user.profile) });
}

export async function logout(req: Request, res: Response) {
  await destroySession(res, req.cookies?.[SESSION_COOKIE]);
  res.status(204).end();
}

export async function me(req: Request, res: Response) {
  const profile = await prisma.userProfile.findUnique({ where: { userId: uid(req) }, select: { id: true } });
  res.json({ user: publicUser(req.user!), onboarded: Boolean(profile) });
}

export async function verifyEmail(req: Request, res: Response) {
  const { token } = parse(tokenSchema, req.body);
  const userId = await consumeToken(token, "email_verification");
  await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  res.json({ verified: true });
}

export async function resendVerification(req: Request, res: Response) {
  const user = req.user!;
  if (user.emailVerifiedAt) return res.json({ sent: false, alreadyVerified: true });
  const token = await issueToken(user.id, "email_verification", 48 * 3_600_000);
  await sendVerificationEmail(user.email, user.fullName, token);
  res.json({ sent: true });
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = parse(forgotSchema, req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const token = await issueToken(user.id, "password_reset", 3_600_000);
    await sendPasswordResetEmail(user.email, token);
  }
  // Same response whether or not the account exists.
  res.json({ message: "If an account exists for that email, a reset link has been sent." });
}

export async function resetPassword(req: Request, res: Response) {
  const d = parse(resetSchema, req.body);
  const userId = await consumeToken(d.token, "password_reset");
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash: await argon2.hash(d.password, ARGON), emailVerifiedAt: new Date() } }),
    // Sign out everywhere after a reset.
    prisma.session.deleteMany({ where: { userId } }),
  ]);
  res.json({ reset: true });
}

export async function changePassword(req: Request, res: Response) {
  const d = parse(changePasswordSchema, req.body);
  if (!(await argon2.verify(req.user!.passwordHash, d.currentPassword))) throw badRequest("Current password is incorrect.");
  const current = sha256(req.cookies?.[SESSION_COOKIE] ?? "");
  await prisma.$transaction([
    prisma.user.update({ where: { id: uid(req) }, data: { passwordHash: await argon2.hash(d.newPassword, ARGON) } }),
    prisma.session.deleteMany({ where: { userId: uid(req), tokenHash: { not: current } } }),
  ]);
  res.json({ changed: true });
}

export async function deleteAccount(req: Request, res: Response) {
  const d = parse(deleteAccountSchema, req.body);
  if (!(await argon2.verify(req.user!.passwordHash, d.password))) throw badRequest("Password is incorrect.");
  const userId = uid(req);
  await deleteUserImages(userId);
  // All user-owned tables cascade on delete.
  await prisma.user.delete({ where: { id: userId } });
  await destroySession(res);
  res.status(204).end();
}

/** GDPR-style export of everything we hold about the user. */
export async function exportData(req: Request, res: Response) {
  const userId = uid(req);
  const data = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, fullName: true, emailVerifiedAt: true, createdAt: true,
      profile: true, goals: true, notificationPreferences: true,
      foodEntries: { where: { deletedAt: null }, orderBy: { eatenAt: "asc" } },
      foodItems: true,
      activities: { where: { deletedAt: null }, orderBy: { startTime: "asc" } },
      stepRecords: { orderBy: { date: "asc" } },
      sleepRecords: { where: { deletedAt: null }, orderBy: { sleepEnd: "asc" } },
      waterRecords: { where: { deletedAt: null }, orderBy: { recordedAt: "asc" } },
      bodyMeasurements: { orderBy: { measuredAt: "asc" } },
      achievements: true,
      aiConversations: { include: { messages: { orderBy: { createdAt: "asc" } } } },
    },
  });
  res.setHeader("Content-Disposition", `attachment; filename="fitpulse-export-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json({ exportedAt: new Date().toISOString(), ...data });
}
