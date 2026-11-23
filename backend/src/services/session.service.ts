import type { Response } from "express";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { randomToken, sha256 } from "./crypto.service.js";

export const SESSION_COOKIE = "fp_session";

export async function createSession(res: Response, userId: string, userAgent?: string) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * 86_400_000);
  await prisma.session.create({
    data: { tokenHash: sha256(token), userId, userAgent: userAgent?.slice(0, 255), expiresAt },
  });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    // Cross-site deployments (frontend and API on different sites) need SameSite=None + Secure.
    sameSite: env.isProd ? "none" : "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function destroySession(res: Response, token?: string) {
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  res.clearCookie(SESSION_COOKIE, { path: "/", httpOnly: true, secure: env.isProd, sameSite: env.isProd ? "none" : "lax" });
}

export async function findSessionUser(token: string) {
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  // Sliding refresh of lastSeenAt at most once per hour.
  if (Date.now() - session.lastSeenAt.getTime() > 3_600_000) {
    await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  }
  return session.user;
}

export function purgeExpiredSessions() {
  return prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
