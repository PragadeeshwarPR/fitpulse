export type MealType = "breakfast" | "morning_snack" | "lunch" | "evening_snack" | "dinner" | "other";
export type Goal = "lose_weight" | "maintain_weight" | "gain_weight" | "build_muscle" | "improve_endurance" | "general_fitness";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type UnitSystem = "metric" | "imperial";

export type User = { id: string; email: string; fullName: string; emailVerified: boolean; createdAt: string };

export type Profile = {
  dateOfBirth: string;
  sex: "male" | "female";
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  unitSystem: UnitSystem;
  dietPreference: string;
  workoutsPerWeek: number;
  aiPersonalization: boolean;
};

export type Goals = {
  goal: Goal;
  targetWeightKg: number;
  bmi: number;
  bmr: number;
  tdee: number;
  dailyCalorieTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
  fiberTargetG: number;
  waterTargetMl: number;
  stepTarget: number;
  sleepTargetMin: number;
};

export type Nutrients = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
};

export type FoodEntry = Nutrients & {
  id: string;
  clientId: string;
  mealType: MealType;
  name: string;
  servings: number;
  portionDesc: string | null;
  source: string;
  aiConfidence: number | null;
  imageUrl: string | null;
  eatenAt: string;
  updatedAt?: string;
  pending?: boolean;
};

export type FoodItem = Nutrients & { id: string; name: string; servingDesc: string; servingG: number | null; userId: string | null; isFavorite: boolean };

export type Activity = {
  id: string;
  clientId: string;
  type: string;
  name: string;
  startTime: string;
  durationMin: number;
  distanceKm: number | null;
  avgPaceMinKm: number | null;
  steps: number | null;
  caloriesBurned: number;
  source: string;
  notes: string | null;
  pending?: boolean;
};

export type WaterRecord = { id: string; clientId: string; amountMl: number; recordedAt: string; pending?: boolean };
export type SleepRecord = {
  id: string;
  clientId: string;
  sleepStart: string;
  sleepEnd: string;
  durationMin: number;
  quality: number;
  notes: string | null;
  pending?: boolean;
};
export type BodyMeasurement = {
  id: string;
  measuredAt: string;
  weightKg: number | null;
  bmi: number | null;
  waistCm: number | null;
  chestCm: number | null;
  hipCm: number | null;
  notes: string | null;
};

export type DaySummary = {
  date: string;
  caloriesIn: number;
  caloriesOut: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
  steps: number;
  distanceKm: number;
  activeMin: number;
  workouts: number;
  waterMl: number;
  sleepMin: number;
  sleepQuality: number | null;
  weightKg: number | null;
  foodLogged: boolean;
};

export type Summary = {
  days: number;
  avgSteps: number;
  totalSteps: number;
  totalDistanceKm: number;
  avgCaloriesIn: number;
  avgCaloriesOut: number;
  avgProteinG: number;
  totalActiveMin: number;
  totalWorkouts: number;
  activeDays: number;
  foodLoggedDays: number;
  avgWaterMl: number;
  avgSleepMin: number;
  sleepConsistencyMin: number;
  weightStart: number | null;
  weightEnd: number | null;
  weightChangeKg: number | null;
};

export type Dashboard = {
  date: string;
  today: DaySummary;
  goals: Goals | null;
  profile: { weightKg: number; heightCm: number; unitSystem: UnitSystem } | null;
  bmiCategory: string | null;
  remainingCalories: number | null;
  activities: Activity[];
  week: DaySummary[];
  weekSummary: Summary;
};

export type Achievement = {
  code: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  unlocked: boolean;
  unlockedAt: string | null;
};
