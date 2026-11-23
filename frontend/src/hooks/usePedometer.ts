import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Counts steps from the device accelerometer (DeviceMotion API) using peak
 * detection on the acceleration magnitude. It only works while this page is
 * open and visible: browsers do not allow background step counting.
 */
export function usePedometer() {
  const supported = typeof window !== "undefined" && "DeviceMotionEvent" in window;
  const [active, setActive] = useState(false);
  const [steps, setSteps] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const state = useRef({ avg: 9.8, lastPeak: 0, above: false });

  const onMotion = useCallback((e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x == null || a.y == null || a.z == null) return;
    const mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    const s = state.current;
    s.avg = s.avg * 0.9 + mag * 0.1; // low-pass baseline (gravity)
    const now = performance.now();
    const threshold = s.avg + 1.2;
    if (mag > threshold && !s.above) {
      s.above = true;
      // Human cadence is at most ~3.5 steps/s.
      if (now - s.lastPeak > 280) {
        s.lastPeak = now;
        setSteps((n) => n + 1);
      }
    } else if (mag < s.avg) {
      s.above = false;
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    const DME = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<"granted" | "denied"> };
    try {
      // iOS requires an explicit permission prompt from a user gesture.
      if (typeof DME.requestPermission === "function" && (await DME.requestPermission()) !== "granted") {
        setError("Motion permission was denied.");
        return;
      }
    } catch {
      setError("Motion sensors are unavailable.");
      return;
    }
    window.addEventListener("devicemotion", onMotion);
    setActive(true);
  }, [onMotion]);

  const stop = useCallback(() => {
    window.removeEventListener("devicemotion", onMotion);
    setActive(false);
  }, [onMotion]);

  useEffect(() => () => window.removeEventListener("devicemotion", onMotion), [onMotion]);

  return { supported, active, steps, error, start, stop, reset: () => setSteps(0) };
}
