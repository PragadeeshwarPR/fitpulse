/**
 * Offline synchronisation. The client queues writes in IndexedDB while offline
 * and replays them here in one batch. Each op carries a client-generated id:
 *  - create: idempotent upsert on (userId, clientId), so retries never duplicate.
 *  - delete: soft delete by clientId (no-op if already deleted / never synced).
 *  - update: applied only if the server copy hasn't changed since the client's
 *    `baseUpdatedAt`; otherwise the server version wins and is returned as a conflict.
 */
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { uid } from "../middleware/auth.js";
import { parse } from "../middleware/validate.js";
import { activitySchema, foodEntrySchema, foodEntryUpdateSchema, sleepSchema, waterSchema } from "../validators/records.validators.js";
import { createActivity, createFoodEntry, createSleep, createWater } from "../services/records.service.js";
import { evaluateAchievements } from "../services/achievements.service.js";

const opSchema = z.object({
  opId: z.string().min(1).max(64),
  entity: z.enum(["food", "activity", "water", "sleep"]),
  action: z.enum(["create", "update", "delete"]),
  clientId: z.string().min(8).max(64),
  baseUpdatedAt: z.coerce.date().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});
const batchSchema = z.object({ ops: z.array(opSchema).max(200) });

type Result = { opId: string; status: "ok" | "conflict" | "error"; serverId?: string; message?: string; server?: unknown };

const delegates = {
  food: () => prisma.foodEntry,
  activity: () => prisma.activity,
  water: () => prisma.waterRecord,
  sleep: () => prisma.sleepRecord,
} as const;

async function applyOp(userId: string, op: z.infer<typeof opSchema>): Promise<Result> {
  const data = { ...(op.data ?? {}), clientId: op.clientId };
  if (op.action === "create") {
    const row =
      op.entity === "food" ? await createFoodEntry(userId, parse(foodEntrySchema, data))
      : op.entity === "activity" ? await createActivity(userId, parse(activitySchema, data))
      : op.entity === "water" ? await createWater(userId, parse(waterSchema, data))
      : await createSleep(userId, parse(sleepSchema, data));
    return { opId: op.opId, status: "ok", serverId: row.id };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = delegates[op.entity]() as any;
  const existing = await model.findUnique({ where: { userId_clientId: { userId, clientId: op.clientId } } });
  if (!existing) {
    // Deleting something the server never saw is fine; updating it is not.
    return op.action === "delete" ? { opId: op.opId, status: "ok" } : { opId: op.opId, status: "error", message: "Record not found" };
  }
  if (op.action === "delete") {
    if (!existing.deletedAt) await model.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    return { opId: op.opId, status: "ok", serverId: existing.id };
  }
  if (existing.deletedAt) return { opId: op.opId, status: "conflict", message: "Record was deleted on another device" };
  if (op.baseUpdatedAt && existing.updatedAt > op.baseUpdatedAt) {
    return { opId: op.opId, status: "conflict", message: "Record changed on another device", server: existing };
  }
  if (op.entity !== "food") return { opId: op.opId, status: "error", message: "Offline updates supported for food entries only" };
  const d = parse(foodEntryUpdateSchema, op.data ?? {});
  const row = await model.update({ where: { id: existing.id }, data: { ...d, aiRaw: undefined } });
  return { opId: op.opId, status: "ok", serverId: row.id };
}

export async function sync(req: Request, res: Response) {
  const userId = uid(req);
  const { ops } = parse(batchSchema, req.body);
  const results: Result[] = [];
  // Sequential so a create followed by a delete of the same record applies in order.
  for (const op of ops) {
    try {
      results.push(await applyOp(userId, op));
    } catch (e) {
      results.push({ opId: op.opId, status: "error", message: (e as Error).message });
    }
  }
  const unlocked = ops.length ? await evaluateAchievements(userId, req.tz) : [];
  res.json({ results, unlocked, serverTime: new Date().toISOString() });
}
