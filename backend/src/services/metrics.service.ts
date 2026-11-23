/**
 * Health calculations. All formulas are standard published estimates and are
 * presented to users as estimates, not medical measurements.
 */
export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Goal =
  | "lose_weight"
  | "maintain_weight"
  | "gain_weight"
  | "build_muscle"
  | "improve_endurance"
  | "general_fitness";

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function ageFromDob(dob: Date, now = new Date()) {
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

export const round1 = (n: number) => Math.round(n * 10) / 10;

export function bmi(weightKg: number, heightCm: number) {
  const m = heightCm / 100;
  return round1(weightKg / (m * m));
}

export function bmiCategory(v: number) {
  if (v < 18.5) return "Underweight";
  if (v < 25) return "Healthy";
  if (v < 30) return "Overweight";
  return "Obese";
}

/** Mifflin-St Jeor equation. */
export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(sex === "male" ? base + 5 : base - 161);
}

export function tdee(bmrValue: number, level: ActivityLevel) {
  return Math.round(bmrValue * ACTIVITY_MULTIPLIERS[level]);
}

const GOAL_ADJUSTMENT: Record<Goal, number> = {
  lose_weight: -500,
  maintain_weight: 0,
  gain_weight: 400,
  build_muscle: 250,
  improve_endurance: 0,
  general_fitness: 0,
};

// Protein g per kg body weight by goal.
const PROTEIN_PER_KG: Record<Goal, number> = {
  lose_weight: 1.8,
  maintain_weight: 1.4,
  gain_weight: 1.6,
  build_muscle: 2.0,
  improve_endurance: 1.5,
  general_fitness: 1.4,
};

export function computeTargets(input: {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  dateOfBirth: Date;
  activityLevel: ActivityLevel;
  goal: Goal;
}) {
  const age = ageFromDob(input.dateOfBirth);
  const b = bmr(input.sex, input.weightKg, input.heightCm, age);
  const t = tdee(b, input.activityLevel);
  // Never recommend below a conservative floor.
  const floor = input.sex === "male" ? 1500 : 1200;
  const target = Math.max(floor, Math.round((t + GOAL_ADJUSTMENT[input.goal]) / 10) * 10);
  const protein = Math.round(input.weightKg * PROTEIN_PER_KG[input.goal]);
  const fat = Math.round((target * 0.27) / 9);
  const carbs = Math.max(0, Math.round((target - protein * 4 - fat * 9) / 4));
  const fiber = Math.round((target / 1000) * 14); // 14 g per 1000 kcal guideline
  const water = Math.round((input.weightKg * 35) / 50) * 50; // ~35 ml/kg
  return {
    age,
    bmi: bmi(input.weightKg, input.heightCm),
    bmr: b,
    tdee: t,
    dailyCalorieTarget: target,
    proteinTargetG: protein,
    carbsTargetG: carbs,
    fatTargetG: fat,
    fiberTargetG: fiber,
    waterTargetMl: water,
  };
}

/** MET values (Compendium of Physical Activities, typical intensities). */
export const ACTIVITY_METS: Record<string, number> = {
  walking: 3.5,
  running: 9.8,
  jogging: 7.0,
  cycling: 7.5,
  swimming: 6.0,
  gym: 5.0,
  weightlifting: 6.0,
  yoga: 2.5,
  hiit: 8.0,
  dancing: 5.0,
  sports: 7.0,
  hiking: 6.0,
  other: 4.0,
};

export const ACTIVITY_TYPES = Object.keys(ACTIVITY_METS);

/** Running/walking MET refined by speed when distance is known. */
function metForSpeed(type: string, speedKmh: number): number | null {
  if (type === "walking") {
    if (speedKmh < 3.2) return 2.8;
    if (speedKmh < 4.8) return 3.5;
    if (speedKmh < 5.6) return 4.3;
    return 5.0;
  }
  if (type === "running" || type === "jogging") {
    if (speedKmh < 8) return 7.0;
    if (speedKmh < 9.7) return 9.0;
    if (speedKmh < 11.3) return 10.5;
    if (speedKmh < 12.9) return 11.5;
    return 12.5;
  }
  if (type === "cycling") {
    if (speedKmh < 16) return 4.0;
    if (speedKmh < 19) return 6.8;
    if (speedKmh < 22.5) return 8.0;
    return 10.0;
  }
  return null;
}

export function caloriesBurned(type: string, durationMin: number, weightKg: number, distanceKm?: number | null) {
  let met = ACTIVITY_METS[type] ?? ACTIVITY_METS.other;
  if (distanceKm && durationMin > 0) {
    met = metForSpeed(type, distanceKm / (durationMin / 60)) ?? met;
  }
  // kcal = MET x weight(kg) x hours
  return Math.round(met * weightKg * (durationMin / 60));
}

export function paceMinPerKm(durationMin: number, distanceKm?: number | null) {
  if (!distanceKm || distanceKm <= 0) return null;
  return round1(durationMin / distanceKm);
}

/** Step length estimate from height (m). */
export function strideMeters(heightCm: number, sex: Sex) {
  return (heightCm / 100) * (sex === "male" ? 0.415 : 0.413);
}

export function stepsToKm(steps: number, heightCm: number, sex: Sex) {
  return round1((steps * strideMeters(heightCm, sex)) / 1000);
}

/** Calories from steps for walking at a normal pace (~0.04 kcal/step at 70 kg). */
export function stepCalories(steps: number, weightKg: number) {
  return Math.round(steps * 0.0005 * weightKg);
}
