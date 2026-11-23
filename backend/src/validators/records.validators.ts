import { z } from "zod";
import { ACTIVITY_TYPES } from "../services/metrics.service.js";

const clientId = z.string().min(8).max(64).optional();
const nutrient = z.number().min(0).max(100000);
const mealType = z.enum(["breakfast", "morning_snack", "lunch", "evening_snack", "dinner", "other"]);

export const foodEntrySchema = z.object({
  clientId,
  foodItemId: z.string().uuid().nullish(),
  mealType,
  name: z.string().trim().min(1).max(120),
  servings: z.number().min(0.05).max(50).default(1),
  portionDesc: z.string().trim().max(120).nullish(),
  calories: z.number().min(0).max(20000),
  proteinG: nutrient.default(0),
  carbsG: nutrient.default(0),
  fatG: nutrient.default(0),
  fiberG: nutrient.default(0),
  sugarG: nutrient.default(0),
  sodiumMg: nutrient.default(0),
  source: z.enum(["manual", "ai_scan", "database", "recent", "favorite"]).default("manual"),
  aiConfidence: z.number().min(0).max(1).nullish(),
  aiRaw: z.any().optional(),
  imageUrl: z.string().url().max(500).nullish(),
  eatenAt: z.coerce.date().default(() => new Date()),
});
export const foodEntryUpdateSchema = foodEntrySchema.partial().omit({ clientId: true });

export const foodItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  servingDesc: z.string().trim().max(60).default("1 serving"),
  servingG: z.number().min(0).max(5000).nullish(),
  calories: z.number().min(0).max(20000),
  proteinG: nutrient.default(0),
  carbsG: nutrient.default(0),
  fatG: nutrient.default(0),
  fiberG: nutrient.default(0),
  sugarG: nutrient.default(0),
  sodiumMg: nutrient.default(0),
  isFavorite: z.boolean().default(true),
});

export const activitySchema = z.object({
  clientId,
  type: z.enum(ACTIVITY_TYPES as [string, ...string[]]),
  name: z.string().trim().min(1).max(80).optional(),
  startTime: z.coerce.date(),
  durationMin: z.number().min(1).max(24 * 60),
  distanceKm: z.number().min(0).max(1000).nullish(),
  steps: z.number().int().min(0).max(200000).nullish(),
  caloriesBurned: z.number().min(0).max(20000).nullish(), // optional override; estimated if absent
  source: z.enum(["manual", "gps", "sensor", "integration"]).default("manual"),
  route: z
    .array(z.object({ lat: z.number(), lng: z.number(), t: z.number() }))
    .max(20000)
    .nullish(),
  notes: z.string().trim().max(1000).nullish(),
});
export const activityUpdateSchema = activitySchema.partial().omit({ clientId: true });

export const stepsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  steps: z.number().int().min(0).max(200000),
  source: z.enum(["manual", "sensor", "integration"]).default("manual"),
});

export const sleepSchema = z
  .object({
    clientId,
    sleepStart: z.coerce.date(),
    sleepEnd: z.coerce.date(),
    quality: z.number().int().min(1).max(5),
    notes: z.string().trim().max(1000).nullish(),
  })
  .refine((d) => d.sleepEnd > d.sleepStart, { message: "Wake-up time must be after sleep time", path: ["sleepEnd"] })
  .refine((d) => d.sleepEnd.getTime() - d.sleepStart.getTime() <= 20 * 3_600_000, {
    message: "Sleep cannot exceed 20 hours",
    path: ["sleepEnd"],
  });

export const waterSchema = z.object({
  clientId,
  amountMl: z.number().int().min(10).max(5000),
  recordedAt: z.coerce.date().default(() => new Date()),
});

export const bodySchema = z
  .object({
    measuredAt: z.coerce.date().default(() => new Date()),
    weightKg: z.number().min(25).max(350).nullish(),
    waistCm: z.number().min(30).max(300).nullish(),
    chestCm: z.number().min(30).max(300).nullish(),
    hipCm: z.number().min(30).max(300).nullish(),
    notes: z.string().trim().max(500).nullish(),
  })
  .refine((d) => d.weightKg || d.waistCm || d.chestCm || d.hipCm, { message: "Enter at least one measurement" });

export const listQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
