import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { parse } from "../middleware/validate.js";
import { uid } from "../middleware/auth.js";
import { onboardingSchema, profileUpdateSchema } from "../validators/profile.validators.js";
import { bmiCategory, computeTargets } from "../services/metrics.service.js";
import { notFound } from "../utils/errors.js";

async function loadProfile(userId: string) {
  const [profile, goals] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.userGoal.findUnique({ where: { userId } }),
  ]);
  return { profile, goals, bmiCategory: goals ? bmiCategory(goals.bmi) : null };
}

export async function getProfile(req: Request, res: Response) {
  res.json(await loadProfile(uid(req)));
}

export async function onboard(req: Request, res: Response) {
  const userId = uid(req);
  const d = parse(onboardingSchema, req.body);
  const t = computeTargets(d);
  const profileData = {
    dateOfBirth: d.dateOfBirth, sex: d.sex, heightCm: d.heightCm, weightKg: d.weightKg, activityLevel: d.activityLevel,
    unitSystem: d.unitSystem, dietPreference: d.dietPreference, workoutsPerWeek: d.workoutsPerWeek, aiPersonalization: d.aiPersonalization,
  };
  const goalData = {
    goal: d.goal, targetWeightKg: d.targetWeightKg, bmi: t.bmi, bmr: t.bmr, tdee: t.tdee,
    dailyCalorieTarget: t.dailyCalorieTarget, proteinTargetG: t.proteinTargetG, carbsTargetG: t.carbsTargetG,
    fatTargetG: t.fatTargetG, fiberTargetG: t.fiberTargetG, waterTargetMl: t.waterTargetMl,
  };
  await prisma.$transaction([
    prisma.userProfile.upsert({ where: { userId }, create: { userId, ...profileData }, update: profileData }),
    prisma.userGoal.upsert({ where: { userId }, create: { userId, ...goalData }, update: goalData }),
    prisma.bodyMeasurement.create({ data: { userId, measuredAt: new Date(), weightKg: d.weightKg, bmi: t.bmi } }),
  ]);
  res.status(201).json(await loadProfile(userId));
}

/** Preview targets without saving (used live in onboarding UI). */
export async function previewTargets(req: Request, res: Response) {
  res.json(computeTargets(parse(onboardingSchema, req.body)));
}

export async function updateProfile(req: Request, res: Response) {
  const userId = uid(req);
  const d = parse(profileUpdateSchema, req.body);
  const current = await loadProfile(userId);
  if (!current.profile || !current.goals) throw notFound("Complete onboarding first");
  const p = current.profile;
  const g = current.goals;
  const merged = {
    dateOfBirth: d.dateOfBirth ?? p.dateOfBirth,
    sex: d.sex ?? p.sex,
    heightCm: d.heightCm ?? p.heightCm,
    weightKg: d.weightKg ?? p.weightKg,
    activityLevel: d.activityLevel ?? p.activityLevel,
    goal: d.goal ?? g.goal,
  };
  const t = computeTargets(merged);
  const recompute = ["dateOfBirth", "sex", "heightCm", "weightKg", "activityLevel", "goal"].some((k) => k in d);

  await prisma.$transaction(async (tx) => {
    if (d.fullName) await tx.user.update({ where: { id: userId }, data: { fullName: d.fullName } });
    await tx.userProfile.update({
      where: { userId },
      data: {
        dateOfBirth: merged.dateOfBirth, sex: merged.sex, heightCm: merged.heightCm, weightKg: merged.weightKg,
        activityLevel: merged.activityLevel, unitSystem: d.unitSystem, dietPreference: d.dietPreference,
        workoutsPerWeek: d.workoutsPerWeek, aiPersonalization: d.aiPersonalization,
      },
    });
    await tx.userGoal.update({
      where: { userId },
      data: {
        goal: merged.goal,
        targetWeightKg: d.targetWeightKg,
        waterTargetMl: d.waterTargetMl ?? (recompute ? t.waterTargetMl : undefined),
        stepTarget: d.stepTarget,
        sleepTargetMin: d.sleepTargetMin,
        ...(recompute
          ? { bmi: t.bmi, bmr: t.bmr, tdee: t.tdee, dailyCalorieTarget: t.dailyCalorieTarget, proteinTargetG: t.proteinTargetG,
              carbsTargetG: t.carbsTargetG, fatTargetG: t.fatTargetG, fiberTargetG: t.fiberTargetG }
          : {}),
        // Explicit manual calorie target wins over the computed one.
        ...(d.dailyCalorieTarget ? { dailyCalorieTarget: d.dailyCalorieTarget } : {}),
      },
    });
    if (d.weightKg && d.weightKg !== p.weightKg) {
      await tx.bodyMeasurement.create({ data: { userId, measuredAt: new Date(), weightKg: d.weightKg, bmi: t.bmi } });
    }
  });
  res.json(await loadProfile(userId));
}
