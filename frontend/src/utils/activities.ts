import {
  Activity as ActivityIcon, Bike, Dumbbell, Footprints, Mountain, Music, PersonStanding, Timer, Trophy, Waves, Zap, Flame, HeartPulse,
} from "lucide-react";

export const ACTIVITY_TYPES = [
  { value: "walking", label: "Walking", icon: Footprints, met: 3.5, distance: true, gps: true },
  { value: "running", label: "Running", icon: Zap, met: 9.8, distance: true, gps: true },
  { value: "jogging", label: "Jogging", icon: Timer, met: 7.0, distance: true, gps: true },
  { value: "cycling", label: "Cycling", icon: Bike, met: 7.5, distance: true, gps: true },
  { value: "swimming", label: "Swimming", icon: Waves, met: 6.0, distance: true, gps: false },
  { value: "gym", label: "Gym workout", icon: Dumbbell, met: 5.0, distance: false, gps: false },
  { value: "weightlifting", label: "Weightlifting", icon: Dumbbell, met: 6.0, distance: false, gps: false },
  { value: "yoga", label: "Yoga", icon: PersonStanding, met: 2.5, distance: false, gps: false },
  { value: "hiit", label: "HIIT", icon: Flame, met: 8.0, distance: false, gps: false },
  { value: "dancing", label: "Dancing", icon: Music, met: 5.0, distance: false, gps: false },
  { value: "sports", label: "Sports", icon: Trophy, met: 7.0, distance: false, gps: false },
  { value: "hiking", label: "Hiking", icon: Mountain, met: 6.0, distance: true, gps: true },
  { value: "other", label: "Other", icon: HeartPulse, met: 4.0, distance: true, gps: false },
] as const;

export const activityMeta = (type: string) => ACTIVITY_TYPES.find((a) => a.value === type) ?? { ...ACTIVITY_TYPES[12], icon: ActivityIcon };

/** Client-side estimate (used offline); the server recomputes with speed-adjusted METs. */
export const estimateKcal = (type: string, durationMin: number, weightKg: number) =>
  Math.round(activityMeta(type).met * weightKg * (durationMin / 60));
