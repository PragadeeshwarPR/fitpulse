/** Achievements, notification preferences and push subscriptions. */
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { uid } from "../middleware/auth.js";
import { parse } from "../middleware/validate.js";
import { ACHIEVEMENTS, evaluateAchievements } from "../services/achievements.service.js";
import { pushEnabled, sendPush } from "../services/push.service.js";

export async function listAchievements(req: Request, res: Response) {
  await evaluateAchievements(uid(req), req.tz);
  const rows = await prisma.achievement.findMany({ where: { userId: uid(req) } });
  const unlocked = new Map(rows.map((r) => [r.code, r.unlockedAt]));
  res.json({
    items: ACHIEVEMENTS.map((a) => ({ ...a, unlocked: unlocked.has(a.code), unlockedAt: unlocked.get(a.code) ?? null })),
  });
}

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const prefsSchema = z
  .object({
    timezone: z.string().max(64).refine((tz) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Invalid timezone"),
    waterReminders: z.boolean(),
    waterInterval: z.number().int().min(30).max(480),
    mealReminders: z.boolean(),
    mealTimes: z.array(hhmm).max(6),
    workoutReminder: z.boolean(),
    workoutTime: hhmm,
    sleepReminder: z.boolean(),
    sleepTime: hhmm,
    activityGoals: z.boolean(),
    weeklyReport: z.boolean(),
    quietStart: hhmm,
    quietEnd: hhmm,
  })
  .partial();

export async function getPrefs(req: Request, res: Response) {
  const userId = uid(req);
  const prefs = await prisma.notificationPreference.upsert({ where: { userId }, create: { userId }, update: {} });
  const subs = await prisma.pushSubscription.count({ where: { userId } });
  res.json({ prefs, pushAvailable: pushEnabled, vapidPublicKey: env.VAPID_PUBLIC_KEY || null, subscribed: subs > 0 });
}

export async function updatePrefs(req: Request, res: Response) {
  const userId = uid(req);
  const d = parse(prefsSchema, req.body);
  res.json({ prefs: await prisma.notificationPreference.upsert({ where: { userId }, create: { userId, ...d }, update: d }) });
}

const subSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
});

export async function subscribePush(req: Request, res: Response) {
  const d = parse(subSchema, req.body);
  await prisma.pushSubscription.upsert({
    where: { endpoint: d.endpoint },
    create: { userId: uid(req), endpoint: d.endpoint, p256dh: d.keys.p256dh, auth: d.keys.auth },
    update: { userId: uid(req), p256dh: d.keys.p256dh, auth: d.keys.auth },
  });
  res.status(201).json({ subscribed: true });
}

export async function unsubscribePush(req: Request, res: Response) {
  const endpoint = z.string().url().parse(req.body?.endpoint);
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: uid(req) } });
  res.status(204).end();
}

export async function testPush(req: Request, res: Response) {
  const sent = await sendPush(uid(req), { title: "FitPulse", body: "Notifications are working 🎉", url: "/" });
  res.json({ sent });
}
