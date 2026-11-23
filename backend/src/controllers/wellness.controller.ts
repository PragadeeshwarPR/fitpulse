/** Sleep, water and body measurement endpoints. */
import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { parse } from "../middleware/validate.js";
import { uid } from "../middleware/auth.js";
import { bodySchema, listQuery, sleepSchema, waterSchema } from "../validators/records.validators.js";
import { createSleep, createWater } from "../services/records.service.js";
import { evaluateAchievements } from "../services/achievements.service.js";
import { bmi } from "../services/metrics.service.js";
import { dayRange } from "../utils/dates.js";
import { notFound } from "../utils/errors.js";

// ---- Sleep ----
export async function listSleep(req: Request, res: Response) {
  const q = parse(listQuery, req.query);
  const where = { userId: uid(req), deletedAt: null };
  const [items, total] = await Promise.all([
    prisma.sleepRecord.findMany({ where, orderBy: { sleepEnd: "desc" }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
    prisma.sleepRecord.count({ where }),
  ]);
  res.json({ items, total, page: q.page, pageSize: q.pageSize });
}

export async function createSleepHandler(req: Request, res: Response) {
  const record = await createSleep(uid(req), parse(sleepSchema, req.body));
  res.status(201).json({ record, unlocked: await evaluateAchievements(uid(req), req.tz) });
}

export async function updateSleep(req: Request, res: Response) {
  const d = parse(sleepSchema, req.body);
  const r = await prisma.sleepRecord.updateMany({
    where: { id: req.params.id, userId: uid(req), deletedAt: null },
    data: {
      sleepStart: d.sleepStart, sleepEnd: d.sleepEnd, quality: d.quality, notes: d.notes,
      durationMin: Math.round((d.sleepEnd.getTime() - d.sleepStart.getTime()) / 60_000),
    },
  });
  if (!r.count) throw notFound();
  res.json({ record: await prisma.sleepRecord.findUnique({ where: { id: req.params.id } }) });
}

export async function deleteSleep(req: Request, res: Response) {
  const r = await prisma.sleepRecord.updateMany({ where: { id: req.params.id, userId: uid(req), deletedAt: null }, data: { deletedAt: new Date() } });
  if (!r.count) throw notFound();
  res.status(204).end();
}

// ---- Water ----
export async function listWater(req: Request, res: Response) {
  const q = parse(listQuery, req.query);
  const { start, end } = dayRange(q.date, req.tz);
  const items = await prisma.waterRecord.findMany({
    where: { userId: uid(req), deletedAt: null, recordedAt: { gte: start, lt: end } },
    orderBy: { recordedAt: "desc" },
  });
  res.json({ items, totalMl: items.reduce((t, i) => t + i.amountMl, 0) });
}

export async function createWaterHandler(req: Request, res: Response) {
  const record = await createWater(uid(req), parse(waterSchema, req.body));
  res.status(201).json({ record, unlocked: await evaluateAchievements(uid(req), req.tz) });
}

export async function deleteWater(req: Request, res: Response) {
  const r = await prisma.waterRecord.updateMany({ where: { id: req.params.id, userId: uid(req), deletedAt: null }, data: { deletedAt: new Date() } });
  if (!r.count) throw notFound();
  res.status(204).end();
}

// ---- Body measurements ----
export async function listBody(req: Request, res: Response) {
  const q = parse(listQuery, req.query);
  const where = { userId: uid(req) };
  const [items, total] = await Promise.all([
    prisma.bodyMeasurement.findMany({ where, orderBy: { measuredAt: "desc" }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
    prisma.bodyMeasurement.count({ where }),
  ]);
  res.json({ items, total, page: q.page, pageSize: q.pageSize });
}

export async function createBody(req: Request, res: Response) {
  const userId = uid(req);
  const d = parse(bodySchema, req.body);
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  const bmiValue = d.weightKg && profile ? bmi(d.weightKg, profile.heightCm) : null;
  const record = await prisma.bodyMeasurement.create({ data: { ...d, bmi: bmiValue, userId } });

  // Keep the profile weight in sync with the most recent weigh-in.
  if (d.weightKg && profile) {
    const latest = await prisma.bodyMeasurement.findFirst({ where: { userId, weightKg: { not: null } }, orderBy: { measuredAt: "desc" } });
    if (latest?.id === record.id) {
      await prisma.userProfile.update({ where: { userId }, data: { weightKg: d.weightKg } });
      await prisma.userGoal.update({ where: { userId }, data: { bmi: bmiValue! } }).catch(() => undefined);
    }
  }
  res.status(201).json({ record, unlocked: await evaluateAchievements(userId, req.tz) });
}

export async function deleteBody(req: Request, res: Response) {
  const r = await prisma.bodyMeasurement.deleteMany({ where: { id: req.params.id, userId: uid(req) } });
  if (!r.count) throw notFound();
  res.status(204).end();
}
