import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { outbox } from "../services/db";
import { flushOutbox } from "../services/syncCore";
import { useToast } from "../context/ToastContext";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

/** Tracks connectivity + pending offline writes and syncs them when online. */
export function useSync(enabled: boolean) {
  const qc = useQueryClient();
  const toast = useToast();
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const inFlight = useRef(false);

  const refreshCount = useCallback(() => outbox.count().then(setPending).catch(() => undefined), []);

  const sync = useCallback(async () => {
    if (!enabled || !navigator.onLine) return;
    // Several triggers (online event, timer, background sync) can fire together; report once.
    if (inFlight.current || (await outbox.count()) === 0) return;
    inFlight.current = true;
    setSyncing(true);
    try {
      const r = await flushOutbox(API_BASE);
      if (r.sent) {
        await qc.invalidateQueries();
        toast.show(
          r.conflicts ? `Synced ${r.ok} change(s); ${r.conflicts} conflicted and kept the server version.` : `Synced ${r.ok} offline change(s).`,
          r.conflicts ? "warning" : "success",
        );
        for (const a of r.unlocked) toast.achievement(a.title);
      }
    } finally {
      inFlight.current = false;
      setSyncing(false);
      refreshCount();
    }
  }, [enabled, qc, toast, refreshCount]);

  useEffect(() => {
    refreshCount();
    const on = () => {
      setOnline(true);
      sync();
    };
    const off = () => setOnline(false);
    const queued = () => {
      refreshCount();
      sync();
    };
    const fromSw = (e: MessageEvent) => {
      if (e.data?.type === "fitpulse:synced") {
        qc.invalidateQueries();
        refreshCount();
      }
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener("fitpulse:outbox", queued);
    navigator.serviceWorker?.addEventListener("message", fromSw);
    sync();
    const t = setInterval(sync, 60_000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("fitpulse:outbox", queued);
      navigator.serviceWorker?.removeEventListener("message", fromSw);
      clearInterval(t);
    };
  }, [sync, refreshCount, qc]);

  return { online, pending, syncing, sync };
}
