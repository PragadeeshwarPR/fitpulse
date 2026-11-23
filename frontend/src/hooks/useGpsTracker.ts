import { useCallback, useEffect, useRef, useState } from "react";

export type GpsPoint = { lat: number; lng: number; t: number };

function haversineKm(a: GpsPoint, b: GpsPoint) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Foreground GPS session tracking. Browsers stop delivering positions when the
 * page is hidden or the screen locks, so we hold a screen wake lock while active.
 */
export function useGpsTracker() {
  const [status, setStatus] = useState<"idle" | "acquiring" | "tracking" | "paused">("idle");
  const [points, setPoints] = useState<GpsPoint[]>([]);
  const [distanceKm, setDistanceKm] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);
  const startedAt = useRef<number>(0);
  const accumulated = useRef(0);
  const last = useRef<GpsPoint | null>(null);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);
  const supported = "geolocation" in navigator;

  const stopWatch = () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    wakeLock.current?.release().catch(() => undefined);
    wakeLock.current = null;
  };

  const startWatch = useCallback(async () => {
    setError(null);
    setStatus("acquiring");
    try {
      wakeLock.current = await (navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen") ?? null;
    } catch {
      /* wake lock unsupported */
    }
    startedAt.current = Date.now();
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setAccuracy(pos.coords.accuracy);
        // Ignore very inaccurate fixes (indoors / cold start).
        if (pos.coords.accuracy > 50) return;
        setStatus("tracking");
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, t: pos.timestamp };
        if (last.current) {
          const d = haversineKm(last.current, p);
          // Drop GPS jitter (< 3 m) and impossible jumps (> 50 m/s).
          const dt = (p.t - last.current.t) / 1000;
          if (d < 0.003 || (dt > 0 && (d * 1000) / dt > 50)) return;
          setDistanceKm((x) => x + d);
        }
        last.current = p;
        setPoints((ps) => [...ps, p]);
      },
      (err) => {
        setError(err.code === err.PERMISSION_DENIED ? "Location permission was denied." : "Couldn't get your location.");
        setStatus("idle");
        stopWatch();
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
    );
  }, []);

  useEffect(() => {
    if (status !== "tracking" && status !== "acquiring") return;
    const t = setInterval(() => setElapsedMs(accumulated.current + Date.now() - startedAt.current), 1000);
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => () => stopWatch(), []);

  return {
    supported,
    status,
    points,
    distanceKm,
    elapsedMs,
    accuracy,
    error,
    start: () => {
      accumulated.current = 0;
      last.current = null;
      setPoints([]);
      setDistanceKm(0);
      setElapsedMs(0);
      startWatch();
    },
    pause: () => {
      accumulated.current += Date.now() - startedAt.current;
      stopWatch();
      last.current = null;
      setStatus("paused");
    },
    resume: () => startWatch(),
    stop: () => {
      if (status !== "paused") accumulated.current += Date.now() - startedAt.current;
      stopWatch();
      setStatus("idle");
      const result = { points, distanceKm, elapsedMs: accumulated.current };
      return result;
    },
  };
}
