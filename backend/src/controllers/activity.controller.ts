import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { parse } from "../middleware/validate.js";
import { uid } from "../middleware/auth.js";
import { activitySchema, activityUpdateSchema, listQuery, stepsSchema } from "../validators/records.validators.js";
import { createActivity, userWeightKg } from "../services/records.service.js";
import { evaluateAchievements } from "../services/achievements.service.js";
import { ACTIVITY_METS, caloriesBurned, paceMinPerKm } from "../services/metrics.service.js";
import { dayRange } from "../utils/dates.js";
import { notFound } from "../utils/errors.js";

export async function listActivities(req: Request, res: Response) {
  const q = parse(listQuery, req.query);
  const userId = uid(req);
  if (q.date) {
    const { start, end } = dayRange(q.date, req.tz);
    const items = await prisma.activity.findMany({
      where: { userId, deletedAt: null, startTime: { gte: start, lt: end } },
      orderBy: { startTime: "desc" },
      omit: { route: true },
    });
    return res.json({ items, total: items.length, page: 1, pageSize: items.length });
  }
  const where = { userId, deletedAt: null };
  const [items, total] = await Promise.all([
    prisma.activity.findMany({ where, orderBy: { startTime: "desc" }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, omit: { route: true } }),
    prisma.activity.count({ where }),
  ]);
  res.json({ items, total, page: q.page, pageSize: q.pageSize });
}

export async function getActivity(req: Request, res: Response) {
  const a = await prisma.activity.findFirst({ where: { id: req.params.id, userId: uid(req), deletedAt: null } });
  if (!a) throw notFound();
  res.json({ activity: a });
}

export async function createActivityHandler(req: Request, res: Response) {
  const activity = await createActivity(uid(req), parse(activitySchema, req.body));
  const unlocked = await evaluateAchievements(uid(req), req.tz);
  res.status(201).json({ activity, unlocked });
}

export async function updateActivity(req: Request, res: Response) {
  const userId = uid(req);
  const d = parse(activityUpdateSchema, req.body);
  const existing = await prisma.activity.findFirst({ where: { id: req.params.id, userId, deletedAt: null } });
  if (!existing) throw notFound();
  const type = d.type ?? existing.type;
  const durationMin = d.durationMin ?? existing.durationMin;
  const distanceKm = d.distanceKm !== undefined ? d.distanceKm : existing.distanceKm;
  const activity = await prisma.activity.update({
    where: { id: existing.id },
    data: {
      ...d,
      route: d.route ?? undefined,
      caloriesBurned: d.caloriesBurned ?? caloriesBurned(type, durationMin, await userWeightKg(userId), distanceKm),
      avgPaceMinKm: paceMinPerKm(durationMin, distanceKm),
    },
  });
  res.json({ activity });
}

export async function deleteActivity(req: Request, res: Response) {
  const r = await prisma.activity.updateMany({ where: { id: req.params.id, userId: uid(req), deletedAt: null }, data: { deletedAt: new Date() } });
  if (!r.count) throw notFound();
  res.status(204).end();
}

export async function estimateCalories(req: Request, res: Response) {
  const type = String(req.query.type ?? "other");
  const duration = Number(req.query.durationMin) || 0;
  const distance = req.query.distanceKm ? Number(req.query.distanceKm) : null;
  res.json({
    caloriesBurned: caloriesBurned(type in ACTIVITY_METS ? type : "other", duration, await userWeightKg(uid(req)), distance),
  });
}

export async function getSteps(req: Request, res: Response) {
  const date = String(req.query.date ?? "");
  const rec = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? await prisma.stepRecord.findUnique({ where: { userId_date: { userId: uid(req), date: new Date(`${date}T00:00:00Z`) } } })
    : null;
  res.json({ steps: rec?.steps ?? 0, source: rec?.source ?? null });
}

/** Set the step total for a local date. Sensor sources never lower an existing count. */
export async function putSteps(req: Request, res: Response) {
  const d = parse(stepsSchema, req.body);
  const userId = uid(req);
  const date = new Date(`${d.date}T00:00:00Z`);
  const existing = await prisma.stepRecord.findUnique({ where: { userId_date: { userId, date } } });
  const steps = d.source === "manual" || !existing ? d.steps : Math.max(existing.steps, d.steps);
  const rec = await prisma.stepRecord.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, steps, source: d.source },
    update: { steps, source: d.source },
  });
  const unlocked = await evaluateAchievements(userId, req.tz);
  res.json({ steps: rec.steps, unlocked });
}
