import { prisma } from "../config/prisma.js";
import { addDays, localDateKey, localMidnightUtc } from "../utils/dates.js";

export type AchievementDef = {
  code: string;
  title: string;
  description: string;
  icon: string;
  category: "steps" | "workout" | "nutrition" | "hydration" | "sleep" | "body";
};

export const ACHIEVEMENTS: AchievementDef[] = [
  { code: "steps_1k", title: "First Steps", description: "Reach 1,000 steps in a day", icon: "footprints", category: "steps" },
  { code: "steps_5k", title: "Moving Up", description: "Reach 5,000 steps in a day", icon: "footprints", category: "steps" },
  { code: "steps_10k", title: "10K Club", description: "Reach 10,000 steps in a day", icon: "trophy", category: "steps" },
  { code: "first_workout", title: "Ignition", description: "Log your first workout", icon: "flame", category: "workout" },
  { code: "workout_streak_7", title: "Unstoppable", description: "Work out 7 days in a row", icon: "zap", category: "workout" },
  { code: "workouts_25", title: "Committed", description: "Log 25 workouts", icon: "dumbbell", category: "workout" },
  { code: "first_meal", title: "Fuel Logged", description: "Log your first meal", icon: "utensils", category: "nutrition" },
  { code: "first_scan", title: "AI Chef", description: "Scan a meal with the AI food scanner", icon: "scan", category: "nutrition" },
  { code: "food_streak_7", title: "Mindful Eater", description: "Log food 7 days in a row", icon: "calendar", category: "nutrition" },
  { code: "hydration_goal", title: "Hydrated", description: "Hit your water target for a day", icon: "droplet", category: "hydration" },
  { code: "hydration_streak_7", title: "Consistent Hydration", description: "Hit your water target 7 days in a row", icon: "droplets", category: "hydration" },
  { code: "sleep_goal", title: "Well Rested", description: "Meet your sleep target", icon: "moon", category: "sleep" },
  { code: "first_weigh_in", title: "Baseline", description: "Record a body measurement", icon: "scale", category: "body" },
];

/** Longest run of consecutive local days ending today (or yesterday) present in `days`. */
export function currentStreak(days: Set<string>, todayKey: string) {
  let streak = 0;
  let cursor = new Date(`${todayKey}T00:00:00Z`);
  if (!days.has(todayKey)) cursor = addDays(cursor, -1);
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Evaluates all achievement rules for a user and stores newly unlocked ones. Returns new codes. */
export async function evaluateAchievements(userId: string, tz: number): Promise<AchievementDef[]> {
  const existing = new Set((await prisma.achievement.findMany({ where: { userId }, select: { code: true } })).map((a) => a.code));
  const since = addDays(localMidnightUtc(new Date(), tz), -30);
  const todayKey = localDateKey(new Date(), tz);

  const [maxSteps, workouts, recentActs, meals, scans, recentFood, water, goals, sleepMax, body] = await Promise.all([
    prisma.stepRecord.aggregate({ where: { userId }, _max: { steps: true } }),
    prisma.activity.count({ where: { userId, deletedAt: null } }),
    prisma.activity.findMany({ where: { userId, deletedAt: null, startTime: { gte: since } }, select: { startTime: true } }),
    prisma.foodEntry.count({ where: { userId, deletedAt: null } }),
    prisma.foodEntry.count({ where: { userId, deletedAt: null, source: "ai_scan" } }),
    prisma.foodEntry.findMany({ where: { userId, deletedAt: null, eatenAt: { gte: since } }, select: { eatenAt: true } }),
    prisma.waterRecord.findMany({ where: { userId, deletedAt: null, recordedAt: { gte: since } }, select: { recordedAt: true, amountMl: true } }),
    prisma.userGoal.findUnique({ where: { userId } }),
    prisma.sleepRecord.aggregate({ where: { userId, deletedAt: null }, _max: { durationMin: true } }),
    prisma.bodyMeasurement.count({ where: { userId } }),
  ]);

  const waterByDay = new Map<string, number>();
  for (const w of water) {
    const k = localDateKey(w.recordedAt, tz);
    waterByDay.set(k, (waterByDay.get(k) ?? 0) + w.amountMl);
  }
  const waterTarget = goals?.waterTargetMl ?? 2500;
  const waterGoalDays = new Set([...waterByDay].filter(([, v]) => v >= waterTarget).map(([k]) => k));
  const steps = maxSteps._max.steps ?? 0;

  const unlocked: Record<string, boolean> = {
    steps_1k: steps >= 1000,
    steps_5k: steps >= 5000,
    steps_10k: steps >= 10000,
    first_workout: workouts >= 1,
    workouts_25: workouts >= 25,
    workout_streak_7: currentStreak(new Set(recentActs.map((a) => localDateKey(a.startTime, tz))), todayKey) >= 7,
    first_meal: meals >= 1,
    first_scan: scans >= 1,
    food_streak_7: currentStreak(new Set(recentFood.map((f) => localDateKey(f.eatenAt, tz))), todayKey) >= 7,
    hydration_goal: waterGoalDays.size >= 1,
    hydration_streak_7: currentStreak(waterGoalDays, todayKey) >= 7,
    sleep_goal: (sleepMax._max.durationMin ?? 0) >= (goals?.sleepTargetMin ?? 480),
    first_weigh_in: body >= 1,
  };

  const fresh = ACHIEVEMENTS.filter((a) => unlocked[a.code] && !existing.has(a.code));
  if (fresh.length) {
    await prisma.achievement.createMany({ data: fresh.map((a) => ({ userId, code: a.code })), skipDuplicates: true });
  }
  return fresh;
}
