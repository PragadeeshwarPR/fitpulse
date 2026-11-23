/**
 * Offline-capable writes for meals, workouts, water and sleep.
 *
 * Every record gets a client-generated `clientId`. We try the API first; if the
 * network is unavailable the write is queued in IndexedDB and applied optimistically
 * to the cached screens (marked `pending`). The outbox is replayed by flushOutbox()
 * when connectivity returns; the server de-duplicates on clientId.
 */
import type { QueryClient } from "@tanstack/react-query";
import { api, isNetworkError } from "./api";
import { outbox, type Entity } from "./db";
import { dateKey } from "../utils/format";
import { estimateKcal } from "../utils/activities";
import type { Activity, Dashboard, FoodEntry, SleepRecord, WaterRecord } from "../utils/types";

const ENDPOINT: Record<Entity, string> = { food: "/food/entries", activity: "/activities", water: "/water", sleep: "/sleep" };
const LIST_KEY: Record<Entity, string> = { food: "food", activity: "activities", water: "water", sleep: "sleep" };

export type WriteResult<T> = { queued: boolean; record: T; unlocked?: Array<{ title: string }> };

async function registerBackgroundSync() {
  try {
    const reg = await navigator.serviceWorker?.ready;
    // Chromium supports Background Sync; other browsers flush on the `online` event instead.
    await (reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } })?.sync?.register("fitpulse-outbox");
  } catch {
    /* unsupported */
  }
  window.dispatchEvent(new Event("fitpulse:outbox"));
}

function recordDate(entity: Entity, d: Record<string, unknown>) {
  const field = entity === "food" ? "eatenAt" : entity === "activity" ? "startTime" : entity === "water" ? "recordedAt" : "sleepEnd";
  return dateKey(new Date(String(d[field] ?? new Date().toISOString())));
}

function patchDashboard(qc: QueryClient, day: string, fn: (d: Dashboard) => void) {
  qc.setQueryData<Dashboard>(["dashboard", day], (old) => {
    if (!old) return old;
    const copy = structuredClone(old);
    fn(copy);
    const w = copy.week.find((x) => x.date === day);
    if (w) Object.assign(w, copy.today);
    if (copy.goals) copy.remainingCalories = copy.goals.dailyCalorieTarget - copy.today.caloriesIn + copy.today.caloriesOut;
    return copy;
  });
}

function applyOptimistic(qc: QueryClient, entity: Entity, rec: Record<string, unknown>, day: string, sign: 1 | -1) {
  if (entity === "food") {
    const f = rec as unknown as FoodEntry;
    qc.setQueryData<{ entries: FoodEntry[] }>(["food", day], (o) =>
      o && { entries: sign > 0 ? [...o.entries, f] : o.entries.filter((e) => e.clientId !== f.clientId) },
    );
    patchDashboard(qc, day, (d) => {
      d.today.caloriesIn += sign * f.calories;
      d.today.proteinG += sign * (f.proteinG ?? 0);
      d.today.carbsG += sign * (f.carbsG ?? 0);
      d.today.fatG += sign * (f.fatG ?? 0);
      d.today.fiberG += sign * (f.fiberG ?? 0);
      d.today.foodLogged = true;
    });
  } else if (entity === "water") {
    const w = rec as unknown as WaterRecord;
    qc.setQueryData<{ items: WaterRecord[]; totalMl: number }>(["water", day], (o) =>
      o && {
        items: sign > 0 ? [w, ...o.items] : o.items.filter((i) => i.clientId !== w.clientId),
        totalMl: o.totalMl + sign * w.amountMl,
      },
    );
    patchDashboard(qc, day, (d) => void (d.today.waterMl += sign * w.amountMl));
  } else if (entity === "activity") {
    const a = rec as unknown as Activity;
    qc.setQueryData<{ items: Activity[] }>(["activities", day], (o) =>
      o && { ...o, items: sign > 0 ? [a, ...o.items] : o.items.filter((i) => i.clientId !== a.clientId) },
    );
    patchDashboard(qc, day, (d) => {
      d.today.caloriesOut += sign * a.caloriesBurned;
      d.today.activeMin += sign * a.durationMin;
      d.today.workouts += sign;
      d.today.distanceKm += sign * (a.distanceKm ?? 0);
      d.activities = sign > 0 ? [...d.activities, a] : d.activities.filter((x) => x.clientId !== a.clientId);
    });
  } else if (entity === "sleep") {
    const s = rec as unknown as SleepRecord;
    qc.setQueryData<{ items: SleepRecord[] }>(["sleep"], (o) =>
      o && { ...o, items: sign > 0 ? [s, ...o.items] : o.items.filter((i) => i.clientId !== s.clientId) },
    );
    patchDashboard(qc, day, (d) => void (d.today.sleepMin += sign * s.durationMin));
  }
}

function invalidateAfterWrite(qc: QueryClient) {
  for (const k of ["dashboard", "food", "water", "activities", "sleep", "analytics", "achievements", "foodRecent"]) {
    qc.invalidateQueries({ queryKey: [k] });
  }
}

/** Builds the local representation shown while a record is pending. */
function localRecord(entity: Entity, clientId: string, data: Record<string, unknown>, weightKg: number) {
  const base = { id: `local-${clientId}`, clientId, pending: true, ...data };
  if (entity === "activity") {
    return { name: String(data.type), caloriesBurned: estimateKcal(String(data.type), Number(data.durationMin), weightKg), avgPaceMinKm: null, ...base };
  }
  if (entity === "sleep") {
    return { ...base, durationMin: Math.round((Date.parse(String(data.sleepEnd)) - Date.parse(String(data.sleepStart))) / 60_000) };
  }
  if (entity === "food") return { servings: 1, source: "manual", fiberG: 0, sugarG: 0, sodiumMg: 0, imageUrl: null, ...base };
  return base;
}

export async function createRecord<T>(
  qc: QueryClient,
  entity: Entity,
  data: Record<string, unknown>,
  opts: { weightKg?: number } = {},
): Promise<WriteResult<T>> {
  const clientId = crypto.randomUUID();
  const payload = { ...data, clientId };
  const day = recordDate(entity, data);
  if (navigator.onLine) {
    try {
      const res = await api<Record<string, unknown>>(ENDPOINT[entity], { method: "POST", json: payload });
      invalidateAfterWrite(qc);
      const record = (res.entry ?? res.activity ?? res.record) as T;
      return { queued: false, record, unlocked: res.unlocked as Array<{ title: string }> };
    } catch (e) {
      if (!isNetworkError(e)) throw e;
    }
  }
  const local = localRecord(entity, clientId, data, opts.weightKg ?? 70);
  await outbox.add({ entity, action: "create", clientId, data });
  applyOptimistic(qc, entity, local, day, 1);
  await registerBackgroundSync();
  return { queued: true, record: local as T };
}

export async function deleteRecord(
  qc: QueryClient,
  entity: Entity,
  rec: { id: string; clientId: string } & Record<string, unknown>,
): Promise<{ queued: boolean }> {
  const day = recordDate(entity, rec);
  if (navigator.onLine && !rec.id.startsWith("local-")) {
    try {
      await api(`${ENDPOINT[entity]}/${rec.id}`, { method: "DELETE" });
      invalidateAfterWrite(qc);
      return { queued: false };
    } catch (e) {
      if (!isNetworkError(e)) throw e;
    }
  }
  await outbox.add({ entity, action: "delete", clientId: rec.clientId });
  applyOptimistic(qc, entity, rec, day, -1);
  await registerBackgroundSync();
  return { queued: true };
}

export { LIST_KEY };
