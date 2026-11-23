import * as webpush from "web-push";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";

export const pushEnabled = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
if (pushEnabled) webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);

export async function sendPush(userId: string, payload: { title: string; body: string; url?: string; tag?: string }) {
  if (!pushEnabled) return 0;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload));
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        // Subscription expired or revoked.
        if (code === 404 || code === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
      }
    }),
  );
  return sent;
}

/** "HH:MM" in the user's timezone. */
function localTime(tz: string, d = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  } catch {
    return d.toISOString().slice(11, 16);
  }
}

function localWeekday(tz: string, d: Date) {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(d);
  } catch {
    return "";
  }
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

function inQuietHours(now: string, start: string, end: string) {
  const n = toMin(now), s = toMin(start), e = toMin(end);
  return s <= e ? n >= s && n < e : n >= s || n < e;
}

/** Runs every minute: sends reminders whose configured time matches the user's local time. */
export async function runReminderTick() {
  if (!pushEnabled) return;
  const prefs = await prisma.notificationPreference.findMany({
    where: {
      OR: [{ waterReminders: true }, { mealReminders: true }, { workoutReminder: true }, { sleepReminder: true }, { activityGoals: true }, { weeklyReport: true }],
      user: { pushSubscriptions: { some: {} } },
    },
  });
  const now = new Date();
  for (const p of prefs) {
    const t = localTime(p.timezone, now);
    const min = toMin(t);
    const jobs: Array<Parameters<typeof sendPush>[1]> = [];
    const quiet = inQuietHours(t, p.quietStart, p.quietEnd);
    if (p.waterReminders && !quiet && min % Math.max(30, p.waterInterval) === 0)
      jobs.push({ title: "Hydration check 💧", body: "Time for a glass of water.", url: "/water", tag: "water" });
    if (p.mealReminders && p.mealTimes.includes(t))
      jobs.push({ title: "Log your meal", body: "Snap a photo with the AI scanner to log it in seconds.", url: "/food", tag: "meal" });
    if (p.workoutReminder && p.workoutTime === t)
      jobs.push({ title: "Workout time 🔥", body: "Your scheduled workout is up. Let's move!", url: "/activity", tag: "workout" });
    if (p.sleepReminder && p.sleepTime === t)
      jobs.push({ title: "Wind down 🌙", body: "Bedtime is approaching. Put the screens away.", url: "/sleep", tag: "sleep" });
    if (p.activityGoals && t === "19:00")
      jobs.push({ title: "Daily goals", body: "Check how close you are to today's step and activity goals.", url: "/", tag: "goals" });
    if (p.weeklyReport && t === "09:00" && localWeekday(p.timezone, now) === "Sun")
      jobs.push({ title: "Your weekly report is ready 📊", body: "See your progress for the past week.", url: "/analytics", tag: "weekly" });
    for (const j of jobs) await sendPush(p.userId, j);
  }
}
