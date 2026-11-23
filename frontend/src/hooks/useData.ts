import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import type { Activity, BodyMeasurement, Dashboard, FoodEntry, Goals, Profile, SleepRecord, WaterRecord } from "../utils/types";

export const useProfile = () =>
  useQuery({ queryKey: ["profile"], queryFn: () => api<{ profile: Profile | null; goals: Goals | null; bmiCategory: string | null }>("/profile") });

/** Unit system from the cached profile (metric until loaded). */
export const useUnits = () => useProfile().data?.profile?.unitSystem ?? "metric";

export const useDashboard = (date: string) =>
  useQuery({ queryKey: ["dashboard", date], queryFn: () => api<Dashboard>(`/dashboard?date=${date}`) });

export const useFoodEntries = (date: string) =>
  useQuery({ queryKey: ["food", date], queryFn: () => api<{ entries: FoodEntry[] }>(`/food/entries?date=${date}`) });

export const useActivities = (date: string) =>
  useQuery({ queryKey: ["activities", date], queryFn: () => api<{ items: Activity[] }>(`/activities?date=${date}`) });

export const useWater = (date: string) =>
  useQuery({ queryKey: ["water", date], queryFn: () => api<{ items: WaterRecord[]; totalMl: number }>(`/water?date=${date}`) });

export const useSleep = () =>
  useQuery({ queryKey: ["sleep"], queryFn: () => api<{ items: SleepRecord[]; total: number }>(`/sleep?pageSize=30`) });

export const useBody = () =>
  useQuery({ queryKey: ["body"], queryFn: () => api<{ items: BodyMeasurement[]; total: number }>(`/body?pageSize=100`) });
