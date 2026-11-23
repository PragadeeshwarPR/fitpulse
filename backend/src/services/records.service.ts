/**
 * Record creation shared by the REST endpoints and the offline sync endpoint.
 * Creates are idempotent on (userId, clientId): replaying the same offline
 * submission returns the existing row instead of creating a duplicate.
 */
import crypto from "node:crypto";
import type { z } from "zod";
import { prisma } from "../config/prisma.js";
import { caloriesBurned, paceMinPerKm } from "./metrics.service.js";
import type { activitySchema, foodEntrySchema, sleepSchema, waterSchema } from "../validators/records.validators.js";

const cid = (v?: string) => v ?? crypto.randomUUID();

export async function userWeightKg(userId: string) {
  const p = await prisma.userProfile.findUnique({ where: { userId }, select: { weightKg: true } });
  return p?.weightKg ?? 70;
}

export async function createFoodEntry(userId: string, d: z.infer<typeof foodEntrySchema>) {
  const clientId = cid(d.clientId);
  return prisma.foodEntry.upsert({
    where: { userId_clientId: { userId, clientId } },
    update: {},
    create: { ...d, aiRaw: d.aiRaw ?? undefined, clientId, userId },
  });
}

export async function createActivity(userId: string, d: z.infer<typeof activitySchema>) {
  const clientId = cid(d.clientId);
  const weight = await userWeightKg(userId);
  const caloriesBurnedValue = d.caloriesBurned ?? caloriesBurned(d.type, d.durationMin, weight, d.distanceKm);
  return prisma.activity.upsert({
    where: { userId_clientId: { userId, clientId } },
    update: {},
    create: {
      ...d,
      route: d.route ?? undefined,
      name: d.name || d.type.charAt(0).toUpperCase() + d.type.slice(1),
      caloriesBurned: caloriesBurnedValue,
      avgPaceMinKm: paceMinPerKm(d.durationMin, d.distanceKm),
      clientId,
      userId,
    },
  });
}

export async function createSleep(userId: string, d: z.infer<typeof sleepSchema>) {
  const clientId = cid(d.clientId);
  const durationMin = Math.round((d.sleepEnd.getTime() - d.sleepStart.getTime()) / 60_000);
  return prisma.sleepRecord.upsert({
    where: { userId_clientId: { userId, clientId } },
    update: {},
    create: { ...d, durationMin, clientId, userId },
  });
}

export async function createWater(userId: string, d: z.infer<typeof waterSchema>) {
  const clientId = cid(d.clientId);
  return prisma.waterRecord.upsert({
    where: { userId_clientId: { userId, clientId } },
    update: {},
    create: { ...d, clientId, userId },
  });
}
