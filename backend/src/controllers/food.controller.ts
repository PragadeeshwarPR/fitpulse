import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { parse } from "../middleware/validate.js";
import { uid } from "../middleware/auth.js";
import { foodEntrySchema, foodEntryUpdateSchema, foodItemSchema, listQuery } from "../validators/records.validators.js";
import { createFoodEntry } from "../services/records.service.js";
import { evaluateAchievements } from "../services/achievements.service.js";
import { analyzeFoodImage } from "../services/gemini.service.js";
import { storeImage, validateImage } from "../services/storage.service.js";
import { dayRange } from "../utils/dates.js";
import { badRequest, notFound } from "../utils/errors.js";
import { z } from "zod";

export async function listEntries(req: Request, res: Response) {
  const q = parse(listQuery, req.query);
  const { start, end } = dayRange(q.date, req.tz);
  const entries = await prisma.foodEntry.findMany({
    where: { userId: uid(req), deletedAt: null, eatenAt: { gte: start, lt: end } },
    orderBy: { eatenAt: "asc" },
    omit: { aiRaw: true },
  });
  res.json({ entries });
}

export async function createEntry(req: Request, res: Response) {
  const entry = await createFoodEntry(uid(req), parse(foodEntrySchema, req.body));
  const unlocked = await evaluateAchievements(uid(req), req.tz);
  res.status(201).json({ entry, unlocked });
}

export async function updateEntry(req: Request, res: Response) {
  const d = parse(foodEntryUpdateSchema, req.body);
  const r = await prisma.foodEntry.updateMany({
    where: { id: req.params.id, userId: uid(req), deletedAt: null },
    data: { ...d, aiRaw: undefined },
  });
  if (!r.count) throw notFound();
  res.json({ entry: await prisma.foodEntry.findUnique({ where: { id: req.params.id } }) });
}

export async function deleteEntry(req: Request, res: Response) {
  const r = await prisma.foodEntry.updateMany({
    where: { id: req.params.id, userId: uid(req), deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (!r.count) throw notFound();
  res.status(204).end();
}

/** Searches the global food database plus the user's own items. */
export async function searchFoods(req: Request, res: Response) {
  const q = z.string().trim().max(60).default("").parse(req.query.q ?? "");
  const items = await prisma.foodItem.findMany({
    where: {
      OR: [{ userId: null }, { userId: uid(req) }],
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: [{ userId: { sort: "desc", nulls: "last" } }, { name: "asc" }],
    take: 30,
  });
  res.json({ items });
}

/** Distinct recently logged foods. */
export async function recentFoods(req: Request, res: Response) {
  const rows = await prisma.foodEntry.findMany({
    where: { userId: uid(req), deletedAt: null },
    orderBy: { eatenAt: "desc" },
    distinct: ["name"],
    take: 15,
    omit: { aiRaw: true },
  });
  res.json({ items: rows });
}

export async function listFavorites(req: Request, res: Response) {
  res.json({ items: await prisma.foodItem.findMany({ where: { userId: uid(req), isFavorite: true }, orderBy: { name: "asc" } }) });
}

export async function createFoodItem(req: Request, res: Response) {
  const d = parse(foodItemSchema, req.body);
  res.status(201).json({ item: await prisma.foodItem.create({ data: { ...d, userId: uid(req) } }) });
}

export async function deleteFoodItem(req: Request, res: Response) {
  const r = await prisma.foodItem.deleteMany({ where: { id: req.params.id, userId: uid(req) } });
  if (!r.count) throw notFound();
  res.status(204).end();
}

/**
 * AI food scan. Returns an *estimate* for the user to review and edit; nothing
 * is written to the diary until the user confirms (POST /food/entries).
 */
export async function scanFood(req: Request, res: Response) {
  if (!req.file) throw badRequest("Attach a photo in the 'image' field.");
  const type = validateImage(req.file.buffer);
  const hint = typeof req.body?.hint === "string" ? req.body.hint : undefined;
  const [analysis, imageUrl] = await Promise.all([
    analyzeFoodImage(uid(req), req.file.buffer, type, hint),
    storeImage(uid(req), req.file.buffer, type).catch((e) => {
      console.error("image store failed", e);
      return null;
    }),
  ]);
  res.json({ analysis, imageUrl });
}
