import { describe, expect, it } from "vitest";
import { bmi, bmr, caloriesBurned, computeTargets, paceMinPerKm, tdee } from "../src/services/metrics.service.js";
import { currentStreak } from "../src/services/achievements.service.js";
import { dayRange, localDateKey } from "../src/utils/dates.js";

describe("metrics", () => {
  it("computes BMI", () => {
    expect(bmi(70, 175)).toBe(22.9);
  });
  it("computes Mifflin-St Jeor BMR", () => {
    expect(bmr("male", 70, 175, 30)).toBe(1649);
    expect(bmr("female", 60, 165, 30)).toBe(1320);
  });
  it("computes TDEE", () => {
    expect(tdee(1649, "moderate")).toBe(2556);
  });
  it("applies goal adjustment and a safety floor", () => {
    const dob = new Date(Date.UTC(new Date().getUTCFullYear() - 30, 0, 1));
    const lose = computeTargets({ sex: "male", weightKg: 70, heightCm: 175, dateOfBirth: dob, activityLevel: "moderate", goal: "lose_weight" });
    expect(lose.dailyCalorieTarget).toBe(2060);
    const tiny = computeTargets({ sex: "female", weightKg: 40, heightCm: 145, dateOfBirth: dob, activityLevel: "sedentary", goal: "lose_weight" });
    expect(tiny.dailyCalorieTarget).toBe(1200);
    expect(lose.proteinTargetG * 4 + lose.carbsTargetG * 4 + lose.fatTargetG * 9).toBeLessThanOrEqual(lose.dailyCalorieTarget + 10);
  });
  it("estimates calories with MET and speed", () => {
    expect(caloriesBurned("yoga", 60, 70)).toBe(175);
    expect(caloriesBurned("running", 30, 70, 5)).toBe(368); // 10 km/h -> MET 10.5
    expect(paceMinPerKm(30, 5)).toBe(6);
  });
});

describe("dates & streaks", () => {
  it("computes local day ranges from tz offset", () => {
    const { start } = dayRange("2026-01-10", -330); // IST
    expect(start.toISOString()).toBe("2026-01-09T18:30:00.000Z");
    expect(localDateKey(new Date("2026-01-09T19:00:00Z"), -330)).toBe("2026-01-10");
  });
  it("counts streaks ending today or yesterday", () => {
    const days = new Set(["2026-01-08", "2026-01-09", "2026-01-10"]);
    expect(currentStreak(days, "2026-01-10")).toBe(3);
    expect(currentStreak(days, "2026-01-11")).toBe(3);
    expect(currentStreak(days, "2026-01-12")).toBe(0);
  });
});
