/**
 * Replays the offline outbox to the backend. Shared by the page and the service
 * worker (Background Sync), so it only depends on fetch + IndexedDB.
 * The server treats creates as idempotent upserts on clientId, so a batch that is
 * sent twice (e.g. the response was lost) never creates duplicates.
 */
import { outbox } from "./db";

export type SyncResult = { sent: number; ok: number; conflicts: number; failed: number; unlocked: Array<{ title: string }> };

let running: Promise<SyncResult> | null = null;

export function flushOutbox(apiBase: string): Promise<SyncResult> {
  running ??= doFlush(apiBase).finally(() => (running = null));
  return running;
}

async function doFlush(apiBase: string): Promise<SyncResult> {
  const result: SyncResult = { sent: 0, ok: 0, conflicts: 0, failed: 0, unlocked: [] };
  const ops = await outbox.all();
  for (let i = 0; i < ops.length; i += 100) {
    const chunk = ops.slice(i, i + 100);
    let res: Response;
    try {
      res = await fetch(`${apiBase}/api/sync`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", "x-tz-offset": String(new Date().getTimezoneOffset()) },
        body: JSON.stringify({
          ops: chunk.map(({ opId, entity, action, clientId, data, baseUpdatedAt }) => ({ opId, entity, action, clientId, data, baseUpdatedAt })),
        }),
      });
    } catch {
      break; // still offline - keep everything queued
    }
    if (res.status === 401) break; // signed out; keep ops until the user signs back in
    if (!res.ok) {
      await outbox.bump(chunk.map((o) => o.opId));
      // Drop ops that keep failing validation so they don't block the queue forever.
      await outbox.remove(chunk.filter((o) => o.attempts >= 5).map((o) => o.opId));
      result.failed += chunk.length;
      continue;
    }
    const body = (await res.json()) as {
      results: Array<{ opId: string; status: "ok" | "conflict" | "error" }>;
      unlocked: Array<{ title: string }>;
    };
    result.sent += chunk.length;
    result.unlocked.push(...(body.unlocked ?? []));
    for (const r of body.results) {
      if (r.status === "ok") result.ok++;
      else if (r.status === "conflict") result.conflicts++;
      else result.failed++;
    }
    // Conflicts resolve server-wins; errors are permanent validation failures. Either way, dequeue.
    await outbox.remove(body.results.map((r) => r.opId));
  }
  return result;
}
