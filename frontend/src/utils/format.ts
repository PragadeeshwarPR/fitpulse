import type { MealType, UnitSystem } from "./types";

/** Local calendar date as YYYY-MM-DD. */
export const dateKey = (d: Date = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
export const todayKey = () => dateKey(new Date());
export const shiftDate = (key: string, days: number) => {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + days);
  return dateKey(d);
};
export const fromKey = (key: string) => new Date(`${key}T12:00:00`);

export const fmtNum = (n: number, digits = 0) =>
  Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 }) : "–";

export const fmtDuration = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
};

export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
export const fmtDay = (key: string, opts: Intl.DateTimeFormatOptions = { weekday: "short" }) =>
  fromKey(key).toLocaleDateString(undefined, opts);

export const prettyDate = (key: string) => {
  const t = todayKey();
  if (key === t) return "Today";
  if (key === shiftDate(t, -1)) return "Yesterday";
  return fromKey(key).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};

export const MEALS: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "morning_snack", label: "Morning snack" },
  { value: "lunch", label: "Lunch" },
  { value: "evening_snack", label: "Evening snack" },
  { value: "dinner", label: "Dinner" },
  { value: "other", label: "Other" },
];

/** Default meal for the current time of day. */
export function suggestMeal(d = new Date()): MealType {
  const h = d.getHours();
  if (h < 10) return "breakfast";
  if (h < 12) return "morning_snack";
  if (h < 15) return "lunch";
  if (h < 18) return "evening_snack";
  if (h < 22) return "dinner";
  return "other";
}

// ---- Units ----
export const KG_PER_LB = 0.45359237;
export const KM_PER_MI = 1.609344;
export const kgToDisplay = (kg: number, u: UnitSystem) => (u === "imperial" ? kg / KG_PER_LB : kg);
export const displayToKg = (v: number, u: UnitSystem) => (u === "imperial" ? v * KG_PER_LB : v);
export const weightUnit = (u: UnitSystem) => (u === "imperial" ? "lb" : "kg");
export const fmtWeight = (kg: number | null | undefined, u: UnitSystem) =>
  kg == null ? "–" : `${fmtNum(kgToDisplay(kg, u), 1)} ${weightUnit(u)}`;
export const fmtDistance = (km: number | null | undefined, u: UnitSystem) =>
  km == null ? "–" : u === "imperial" ? `${fmtNum(km / KM_PER_MI, 2)} mi` : `${fmtNum(km, 2)} km`;
export const cmToFtIn = (cm: number) => {
  const totalIn = cm / 2.54;
  return { ft: Math.floor(totalIn / 12), inch: Math.round(totalIn % 12) };
};
export const lengthUnit = (u: UnitSystem) => (u === "imperial" ? "in" : "cm");
export const cmToDisplay = (cm: number, u: UnitSystem) => (u === "imperial" ? cm / 2.54 : cm);
export const displayToCm = (v: number, u: UnitSystem) => (u === "imperial" ? v * 2.54 : v);
export const fmtPace = (minPerKm: number | null, u: UnitSystem) => {
  if (!minPerKm) return "–";
  const p = u === "imperial" ? minPerKm * KM_PER_MI : minPerKm;
  const m = Math.floor(p);
  const s = Math.round((p - m) * 60);
  return `${m}:${String(s).padStart(2, "0")} /${u === "imperial" ? "mi" : "km"}`;
};

/** ISO string -> value for <input type="datetime-local"> in local time. */
export const toLocalInput = (d: Date) => {
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
};
