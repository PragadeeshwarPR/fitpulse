import { prisma } from "../config/prisma.js";
import { addDays, localDateKey } from "../utils/dates.js";
import { stepCalories, strideMeters } from "./metrics.service.js";

export type DaySummary = {
  date: string;
  caloriesIn: number;
  caloriesOut: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
  steps: number;
  distanceKm: number;
  activeMin: number;
  workouts: number;
  waterMl: number;
  sleepMin: number;
  sleepQuality: number | null;
  weightKg: number | null;
  foodLogged: boolean;
};

/**
 * Aggregates per-local-day totals for [start, start + days). Done in a handful of
 * indexed range queries and grouped in memory, so a 90-day range stays cheap.
 */
export async function dailySeries(userId: string, start: Date, days: number, tz: number): Promise<DaySummary[]> {
  const end = addDays(start, days);
  const startKey = localDateKey(start, tz);
  const endKey = localDateKey(end, tz);
  const [profile, food, acts, steps, water, sleep, body] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.foodEntry.findMany({ where: { userId, deletedAt: null, eatenAt: { gte: start, lt: end } } }),
    prisma.activity.findMany({ where: { userId, deletedAt: null, startTime: { gte: start, lt: end } } }),
    prisma.stepRecord.findMany({
      where: { userId, date: { gte: new Date(`${startKey}T00:00:00Z`), lt: new Date(`${endKey}T00:00:00Z`) } },
    }),
    prisma.waterRecord.findMany({ where: { userId, deletedAt: null, recordedAt: { gte: start, lt: end } } }),
    // Sleep is attributed to the day you wake up.
    prisma.sleepRecord.findMany({ where: { userId, deletedAt: null, sleepEnd: { gte: start, lt: end } } }),
    prisma.bodyMeasurement.findMany({
      where: { userId, measuredAt: { gte: start, lt: end }, weightKg: { not: null } },
      orderBy: { measuredAt: "asc" },
    }),
  ]);

  const map = new Map<string, DaySummary>();
  for (let i = 0; i < days; i++) {
    const date = localDateKey(addDays(start, i), tz);
    map.set(date, {
      date, caloriesIn: 0, caloriesOut: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, sodiumMg: 0,
      steps: 0, distanceKm: 0, activeMin: 0, workouts: 0, waterMl: 0, sleepMin: 0, sleepQuality: null, weightKg: null,
      foodLogged: false,
    });
  }
  const get = (d: Date) => map.get(localDateKey(d, tz));

  for (const f of food) {
    const s = get(f.eatenAt);
    if (!s) continue;
    s.caloriesIn += f.calories;
    s.proteinG += f.proteinG;
    s.carbsG += f.carbsG;
    s.fatG += f.fatG;
    s.fiberG += f.fiberG;
    s.sugarG += f.sugarG;
    s.sodiumMg += f.sodiumMg;
    s.foodLogged = true;
  }
  // Steps covered by on-foot activities (explicit steps, or estimated from distance).
  const ON_FOOT = new Set(["walking", "running", "jogging", "hiking"]);
  const strideM = profile ? strideMeters(profile.heightCm, profile.sex) : 0.75;
  const activityStepsByDay = new Map<string, number>();
  for (const a of acts) {
    const s = get(a.startTime);
    if (!s) continue;
    s.caloriesOut += a.caloriesBurned;
    s.activeMin += a.durationMin;
    s.workouts += 1;
    s.distanceKm += a.distanceKm ?? 0;
    const est = a.steps ?? (ON_FOOT.has(a.type) && a.distanceKm ? Math.round((a.distanceKm * 1000) / strideM) : 0);
    if (est) activityStepsByDay.set(s.date, (activityStepsByDay.get(s.date) ?? 0) + est);
  }
  const recordSteps = new Map(steps.map((r) => [r.date.toISOString().slice(0, 10), r.steps]));
  for (const s of map.values()) {
    const logged = recordSteps.get(s.date) ?? 0;
    const fromActs = activityStepsByDay.get(s.date) ?? 0;
    // A daily step total usually already includes steps walked during workouts, so only
    // the steps beyond those covered by activities add extra distance and calories.
    const untracked = Math.max(0, logged - fromActs);
    s.steps = Math.max(logged, fromActs);
    if (untracked > 0) {
      s.distanceKm += (untracked * strideM) / 1000;
      s.caloriesOut += stepCalories(untracked, profile?.weightKg ?? 70);
    }
  }
  for (const w of water) {
    const s = get(w.recordedAt);
    if (s) s.waterMl += w.amountMl;
  }
  for (const r of sleep) {
    const s = get(r.sleepEnd);
    if (!s) continue;
    s.sleepQuality = s.sleepMin ? Math.round(((s.sleepQuality ?? r.quality) + r.quality) / 2) : r.quality;
    s.sleepMin += r.durationMin;
  }
  for (const b of body) {
    const s = get(b.measuredAt);
    if (s) s.weightKg = b.weightKg;
  }
  return [...map.values()].map((s) => ({
    ...s,
    caloriesIn: Math.round(s.caloriesIn),
    caloriesOut: Math.round(s.caloriesOut),
    proteinG: Math.round(s.proteinG * 10) / 10,
    carbsG: Math.round(s.carbsG * 10) / 10,
    fatG: Math.round(s.fatG * 10) / 10,
    fiberG: Math.round(s.fiberG * 10) / 10,
    sugarG: Math.round(s.sugarG * 10) / 10,
    sodiumMg: Math.round(s.sodiumMg),
    distanceKm: Math.round(s.distanceKm * 100) / 100,
    activeMin: Math.round(s.activeMin),
  }));
}

export function summarize(series: DaySummary[]) {
  const n = series.length || 1;
  const sum = (k: keyof DaySummary) => series.reduce((t, s) => t + (Number(s[k]) || 0), 0);
  const loggedFood = series.filter((s) => s.foodLogged);
  const sleptDays = series.filter((s) => s.sleepMin > 0);
  const weights = series.filter((s) => s.weightKg != null).map((s) => s.weightKg!);
  const sleepMins = sleptDays.map((s) => s.sleepMin);
  const avgSleep = sleepMins.length ? sleepMins.reduce((a, b) => a + b, 0) / sleepMins.length : 0;
  const sleepStdDev = sleepMins.length
    ? Math.sqrt(sleepMins.reduce((t, m) => t + (m - avgSleep) ** 2, 0) / sleepMins.length)
    : 0;
  return {
    days: series.length,
    avgSteps: Math.round(sum("steps") / n),
    totalSteps: sum("steps"),
    totalDistanceKm: Math.round(sum("distanceKm") * 10) / 10,
    avgCaloriesIn: loggedFood.length ? Math.round(loggedFood.reduce((t, s) => t + s.caloriesIn, 0) / loggedFood.length) : 0,
    avgCaloriesOut: Math.round(sum("caloriesOut") / n),
    avgProteinG: loggedFood.length ? Math.round(loggedFood.reduce((t, s) => t + s.proteinG, 0) / loggedFood.length) : 0,
    totalActiveMin: sum("activeMin"),
    totalWorkouts: sum("workouts"),
    activeDays: series.filter((s) => s.workouts > 0).length,
    foodLoggedDays: loggedFood.length,
    avgWaterMl: Math.round(sum("waterMl") / n),
    avgSleepMin: Math.round(avgSleep),
    sleepConsistencyMin: Math.round(sleepStdDev),
    weightStart: weights[0] ?? null,
    weightEnd: weights.at(-1) ?? null,
    weightChangeKg: weights.length >= 2 ? Math.round((weights.at(-1)! - weights[0]) * 10) / 10 : null,
  };
}
