import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { uid } from "../middleware/auth.js";
import { parse } from "../middleware/validate.js";
import { dailySeries, summarize } from "../services/analytics.service.js";
import { bmiCategory } from "../services/metrics.service.js";
import { addDays, dayRange, localDateKey } from "../utils/dates.js";

/** Everything the dashboard needs for one day in a single request. */
export async function dashboard(req: Request, res: Response) {
  const userId = uid(req);
  const date = typeof req.query.date === "string" ? req.query.date : undefined;
  const { start, end } = dayRange(date, req.tz);
  const weekStart = addDays(start, -6);
  const [goals, profile, week, activities] = await Promise.all([
    prisma.userGoal.findUnique({ where: { userId } }),
    prisma.userProfile.findUnique({ where: { userId } }),
    dailySeries(userId, weekStart, 7, req.tz),
    prisma.activity.findMany({
      where: { userId, deletedAt: null, startTime: { gte: start, lt: end } },
      orderBy: { startTime: "asc" },
      omit: { route: true },
    }),
  ]);
  const today = week.at(-1)!;
  res.json({
    date: localDateKey(start, req.tz),
    today,
    goals,
    profile: profile && { weightKg: profile.weightKg, heightCm: profile.heightCm, unitSystem: profile.unitSystem },
    bmiCategory: goals ? bmiCategory(goals.bmi) : null,
    remainingCalories: goals ? goals.dailyCalorieTarget - today.caloriesIn + today.caloriesOut : null,
    activities,
    week,
    weekSummary: summarize(week),
  });
}

const rangeQuery = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** Daily series + summary for an arbitrary date range (max 366 days). */
export async function range(req: Request, res: Response) {
  const q = parse(rangeQuery, req.query);
  const { start } = dayRange(q.from, req.tz);
  const days = Math.min(366, Math.max(1, Math.round((Date.parse(q.to) - Date.parse(q.from)) / 86_400_000) + 1));
  const userId = uid(req);
  const [series, goals, weights] = await Promise.all([
    dailySeries(userId, start, days, req.tz),
    prisma.userGoal.findUnique({ where: { userId } }),
    prisma.bodyMeasurement.findMany({
      where: { userId, weightKg: { not: null }, measuredAt: { gte: start, lt: addDays(start, days) } },
      orderBy: { measuredAt: "asc" },
      select: { measuredAt: true, weightKg: true, bmi: true },
    }),
  ]);
  const summary = summarize(series);
  const goalCompletion = goals
    ? {
        stepDays: series.filter((s) => s.steps >= goals.stepTarget).length,
        waterDays: series.filter((s) => s.waterMl >= goals.waterTargetMl).length,
        sleepDays: series.filter((s) => s.sleepMin >= goals.sleepTargetMin).length,
        calorieDays: series.filter((s) => s.foodLogged && Math.abs(s.caloriesIn - goals.dailyCalorieTarget) <= goals.dailyCalorieTarget * 0.1).length,
        proteinDays: series.filter((s) => s.proteinG >= goals.proteinTargetG * 0.9).length,
      }
    : null;
  res.json({ series, summary, goals, goalCompletion, weights });
}
