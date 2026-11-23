import { z } from "zod";

export const onboardingSchema = z.object({
  dateOfBirth: z.coerce
    .date()
    .refine((d) => {
      const age = (Date.now() - d.getTime()) / (365.25 * 86_400_000);
      return age >= 13 && age <= 110;
    }, "You must be between 13 and 110 years old"),
  sex: z.enum(["male", "female"]),
  heightCm: z.number().min(100).max(250),
  weightKg: z.number().min(25).max(350),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
  goal: z.enum(["lose_weight", "maintain_weight", "gain_weight", "build_muscle", "improve_endurance", "general_fitness"]),
  targetWeightKg: z.number().min(25).max(350),
  unitSystem: z.enum(["metric", "imperial"]).default("metric"),
  dietPreference: z.string().trim().max(40).default("none"),
  workoutsPerWeek: z.number().int().min(0).max(14).default(3),
  aiPersonalization: z.boolean().default(true),
});

export const profileUpdateSchema = onboardingSchema.partial().extend({
  fullName: z.string().trim().min(2).max(100).optional(),
  waterTargetMl: z.number().int().min(500).max(8000).optional(),
  stepTarget: z.number().int().min(1000).max(60000).optional(),
  sleepTargetMin: z.number().int().min(240).max(720).optional(),
  dailyCalorieTarget: z.number().int().min(1000).max(6000).optional(),
});
