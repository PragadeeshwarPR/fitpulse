/**
 * IndexedDB storage:
 *  - `outbox`: writes made while offline, replayed to /api/sync when back online.
 *  - `kv`: persisted React Query cache (so dashboards and diaries open offline).
 * Kept free of DOM/React imports so the service worker can use it too.
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export type Entity = "food" | "activity" | "water" | "sleep";
export type OutboxOp = {
  opId: string;
  entity: Entity;
  action: "create" | "update" | "delete";
  clientId: string;
  data?: Record<string, unknown>;
  baseUpdatedAt?: string;
  createdAt: number;
  attempts: number;
};

interface FitPulseDB extends DBSchema {
  outbox: { key: string; value: OutboxOp; indexes: { createdAt: number } };
  kv: { key: string; value: unknown };
}

let dbp: Promise<IDBPDatabase<FitPulseDB>> | null = null;
export function db() {
  dbp ??= openDB<FitPulseDB>("fitpulse", 1, {
    upgrade(d) {
      const ob = d.createObjectStore("outbox", { keyPath: "opId" });
      ob.createIndex("createdAt", "createdAt");
      d.createObjectStore("kv");
    },
  });
  return dbp;
}

export const outbox = {
  async add(op: Omit<OutboxOp, "opId" | "createdAt" | "attempts">) {
    const full: OutboxOp = { ...op, opId: crypto.randomUUID(), createdAt: Date.now(), attempts: 0 };
    await (await db()).put("outbox", full);
    return full;
  },
  async all() {
    return (await db()).getAllFromIndex("outbox", "createdAt");
  },
  async remove(ids: string[]) {
    const tx = (await db()).transaction("outbox", "readwrite");
    await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
  },
  async bump(ids: string[]) {
    const tx = (await db()).transaction("outbox", "readwrite");
    for (const id of ids) {
      const op = await tx.store.get(id);
      if (op) await tx.store.put({ ...op, attempts: op.attempts + 1 });
    }
    await tx.done;
  },
  async count() {
    return (await db()).count("outbox");
  },
  async clear() {
    await (await db()).clear("outbox");
  },
};

export const kv = {
  get: async <T>(k: string) => (await (await db()).get("kv", k)) as T | undefined,
  set: async (k: string, v: unknown) => void (await (await db()).put("kv", v, k)),
  del: async (k: string) => void (await (await db()).delete("kv", k)),
};
