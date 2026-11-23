import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Activity as ActivityIcon, Footprints, Info, MapPin, Pause, Play, Plus, Smartphone, Square, Trash2 } from "lucide-react";
import { useActivities, useProfile, useUnits } from "../hooks/useData";
import { useGpsTracker } from "../hooks/useGpsTracker";
import { usePedometer } from "../hooks/usePedometer";
import { api } from "../services/api";
import { createRecord, deleteRecord } from "../services/offline";
import { useToast } from "../context/ToastContext";
import { DateNav, EmptyState, Field, Modal, PageHeader, PageLoader, PendingBadge, Spinner } from "../components/ui";
import { ACTIVITY_TYPES, activityMeta, estimateKcal } from "../utils/activities";
import { KM_PER_MI, fmtDistance, fmtDuration, fmtNum, fmtPace, fmtTime, toLocalInput, todayKey } from "../utils/format";
import type { Activity } from "../utils/types";

function ManualActivityModal({ open, onClose, date, weightKg }: { open: boolean; onClose: () => void; date: string; weightKg: number }) {
  const qc = useQueryClient();
  const toast = useToast();
  const units = useUnits();
  const [type, setType] = useState("walking");
  const [name, setName] = useState("");
  const [start, setStart] = useState(() => toLocalInput(date === todayKey() ? new Date(Date.now() - 30 * 60_000) : new Date(`${date}T08:00:00`)));
  const [duration, setDuration] = useState(30);
  const [distance, setDistance] = useState("");
  const [kcalOverride, setKcalOverride] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const meta = activityMeta(type);
  const distanceKm = distance ? (units === "imperial" ? Number(distance) * KM_PER_MI : Number(distance)) : null;

  const est = useQuery({
    queryKey: ["estimate", type, duration, distanceKm],
    queryFn: () =>
      api<{ caloriesBurned: number }>(`/activities/estimate?type=${type}&durationMin=${duration}${distanceKm ? `&distanceKm=${distanceKm}` : ""}`),
    enabled: open && duration > 0 && navigator.onLine,
    staleTime: Infinity,
  });
  const estimate = est.data?.caloriesBurned ?? estimateKcal(type, duration, weightKg);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await createRecord<Activity>(
        qc,
        "activity",
        {
          type,
          name: name.trim() || meta.label,
          startTime: new Date(start).toISOString(),
          durationMin: duration,
          distanceKm,
          caloriesBurned: kcalOverride ? Number(kcalOverride) : null,
          source: "manual",
          notes: notes.trim() || null,
        },
        { weightKg },
      );
      toast.show(r.queued ? "Workout saved offline — will sync later" : "Activity logged", "success");
      r.unlocked?.forEach((a) => toast.achievement(a.title));
      onClose();
    } catch (err) {
      toast.show((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Log activity" wide>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {ACTIVITY_TYPES.map((a) => (
            <button
              type="button"
              key={a.value}
              onClick={() => setType(a.value)}
              aria-pressed={type === a.value}
              className={clsx(
                "flex flex-col items-center gap-1 rounded-2xl border p-2.5 text-[11px] font-medium transition",
                type === a.value ? "border-green bg-green/10 text-green" : "border-line bg-card-2 text-ink-2 hover:text-ink",
              )}
            >
              <a.icon className="size-5" />
              {a.label}
            </button>
          ))}
        </div>
        {type === "other" && <Field label="Activity name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rock climbing" />}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start time" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
          <Field label="Duration (min)" type="number" min={1} max={1440} value={duration} onChange={(e) => setDuration(Number(e.target.value))} required />
        </div>
        {meta.distance && (
          <Field
            label={`Distance (${units === "imperial" ? "mi" : "km"}) — optional`}
            type="number"
            step="0.01"
            min={0}
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            hint={distanceKm && duration ? `Pace ${fmtPace(duration / distanceKm, units)}` : undefined}
          />
        )}
        <Field
          label="Calories burned (kcal)"
          type="number"
          min={0}
          placeholder={`Estimated ${estimate}`}
          value={kcalOverride}
          onChange={(e) => setKcalOverride(e.target.value)}
          hint={`Estimated ${estimate} kcal from MET × your weight × duration. Enter a value from your wearable to override.`}
        />
        <div>
          <label className="label" htmlFor="notes">
            Notes
          </label>
          <textarea id="notes" className="input min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
        </div>
        <button className="btn-primary w-full" disabled={busy || duration < 1}>
          {busy ? <Spinner className="size-4 text-on-green" /> : "Save activity"}
        </button>
      </form>
    </Modal>
  );
}

function GpsCard({ weightKg }: { weightKg: number }) {
  const gps = useGpsTracker();
  const qc = useQueryClient();
  const toast = useToast();
  const units = useUnits();
  const [type, setType] = useState<"walking" | "running" | "cycling" | "hiking">("walking");
  const min = gps.elapsedMs / 60_000;
  const running = gps.status === "tracking" || gps.status === "acquiring";

  async function finish() {
    const r = gps.stop();
    const durationMin = Math.max(1, Math.round(r.elapsedMs / 60_000));
    if (r.distanceKm < 0.01 && durationMin < 2) {
      toast.show("Session too short to save.", "warning");
      return;
    }
    const res = await createRecord(
      qc,
      "activity",
      {
        type,
        startTime: new Date(Date.now() - r.elapsedMs).toISOString(),
        durationMin,
        distanceKm: Math.round(r.distanceKm * 100) / 100,
        source: "gps",
        route: r.points.length > 2000 ? r.points.filter((_, i) => i % Math.ceil(r.points.length / 2000) === 0) : r.points,
      },
      { weightKg },
    );
    toast.show(res.queued ? "GPS session saved offline" : "GPS session saved", "success");
    res.unlocked?.forEach((a) => toast.achievement(a.title));
  }

  return (
    <section className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display font-semibold">
          <MapPin className="size-4 text-green" /> GPS session
        </h2>
        {gps.accuracy != null && gps.status !== "idle" && <span className="text-xs text-ink-3">±{Math.round(gps.accuracy)} m</span>}
      </div>
      {!gps.supported ? (
        <p className="text-sm text-ink-2">Location isn't available in this browser. Use manual entry instead.</p>
      ) : (
        <>
          {gps.status === "idle" && (
            <div className="flex flex-wrap gap-2">
              {(["walking", "running", "cycling", "hiking"] as const).map((t) => (
                <button key={t} onClick={() => setType(t)} className={clsx("chip capitalize", type === t && "chip-active")}>
                  {t}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-card-2 p-3">
              <div className="font-display text-xl font-bold tabular-nums">{fmtDuration(min)}</div>
              <div className="text-xs text-ink-3">Time</div>
            </div>
            <div className="rounded-2xl bg-card-2 p-3">
              <div className="font-display text-xl font-bold tabular-nums">{fmtDistance(gps.distanceKm, units)}</div>
              <div className="text-xs text-ink-3">Distance</div>
            </div>
            <div className="rounded-2xl bg-card-2 p-3">
              <div className="font-display text-xl font-bold tabular-nums">{gps.distanceKm > 0.05 ? fmtPace(min / gps.distanceKm, units).split(" ")[0] : "–"}</div>
              <div className="text-xs text-ink-3">Pace</div>
            </div>
          </div>
          {gps.status === "acquiring" && <p className="text-xs text-ink-3">Waiting for an accurate GPS fix… head outdoors for best results.</p>}
          {gps.error && <p className="text-sm text-danger">{gps.error}</p>}
          <div className="flex gap-2">
            {gps.status === "idle" && (
              <button className="btn-primary flex-1" onClick={gps.start}>
                <Play className="size-4" /> Start {type}
              </button>
            )}
            {running && (
              <button className="btn-ghost flex-1" onClick={gps.pause}>
                <Pause className="size-4" /> Pause
              </button>
            )}
            {gps.status === "paused" && (
              <button className="btn-ghost flex-1" onClick={gps.resume}>
                <Play className="size-4" /> Resume
              </button>
            )}
            {gps.status !== "idle" && (
              <button className="btn-primary flex-1" onClick={finish}>
                <Square className="size-4" /> Finish & save
              </button>
            )}
          </div>
          <p className="text-xs text-ink-3">
            Keep FitPulse open with the screen on during the session ({Math.round(estimateKcal(type, Math.max(min, 1), weightKg))} kcal so far, estimated).
            Browsers pause GPS when the app is in the background.
          </p>
        </>
      )}
    </section>
  );
}

function StepsCard({ date, stepTarget }: { date: string; stepTarget: number }) {
  const qc = useQueryClient();
  const toast = useToast();
  const ped = usePedometer();
  const steps = useQuery({ queryKey: ["steps", date], queryFn: () => api<{ steps: number; source: string | null }>(`/steps?date=${date}`) });
  const [manual, setManual] = useState("");
  const [saving, setSaving] = useState(false);
  const isToday = date === todayKey();
  const current = steps.data?.steps ?? 0;

  async function save(value: number, source: "manual" | "sensor") {
    setSaving(true);
    try {
      const r = await api<{ steps: number; unlocked: Array<{ title: string }> }>("/steps", { method: "PUT", json: { date, steps: value, source } });
      qc.setQueryData(["steps", date], { steps: r.steps, source });
      for (const k of ["dashboard", "analytics", "achievements"]) qc.invalidateQueries({ queryKey: [k] });
      r.unlocked.forEach((a) => toast.achievement(a.title));
      toast.show("Steps saved", "success");
      setManual("");
    } catch (e) {
      toast.show((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  // Persist sensor-counted steps (added to the saved total) every 100 steps and when stopping.
  const [savedSensor, setSavedSensor] = useState(0);
  useEffect(() => {
    if (ped.active && ped.steps - savedSensor >= 100) {
      setSavedSensor(ped.steps);
      api("/steps", { method: "PUT", json: { date: todayKey(), steps: current + ped.steps - savedSensor, source: "sensor" } })
        .then(() => qc.invalidateQueries({ queryKey: ["steps"] }))
        .catch(() => undefined);
    }
  }, [ped.steps, ped.active, savedSensor, current, qc]);

  return (
    <section className="card space-y-4">
      <h2 className="flex items-center gap-2 font-display font-semibold">
        <Footprints className="size-4 text-green" /> Steps
      </h2>
      <div className="flex items-end gap-2">
        <span className="font-display text-4xl font-bold tabular-nums">{fmtNum(current + (ped.active ? ped.steps - savedSensor : 0))}</span>
        <span className="pb-1 text-sm text-ink-3">/ {fmtNum(stepTarget)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-card-2">
        <div className="h-full rounded-full bg-green transition-all" style={{ width: `${Math.min(100, (current / stepTarget) * 100)}%` }} />
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (manual) save(Number(manual), "manual");
        }}
      >
        <input className="input" type="number" min={0} max={200000} placeholder="Enter today's total from your phone or watch" value={manual} onChange={(e) => setManual(e.target.value)} aria-label="Step count" />
        <button className="btn-ghost shrink-0" disabled={!manual || saving}>
          Save
        </button>
      </form>
      {isToday && ped.supported && (
        <div className="rounded-2xl bg-card-2 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Smartphone className="size-4 text-green" /> Live step counter {ped.active && <span className="text-xs text-green">● counting {ped.steps}</span>}
          </div>
          {ped.error && <p className="mb-2 text-xs text-danger">{ped.error}</p>}
          <button
            className={ped.active ? "btn-ghost w-full" : "btn-primary w-full"}
            onClick={async () => {
              if (ped.active) {
                ped.stop();
                const extra = ped.steps - savedSensor;
                if (extra > 0) await save(current + extra, "sensor");
                ped.reset();
                setSavedSensor(0);
              } else ped.start();
            }}
          >
            {ped.active ? "Stop & save" : "Start counting"}
          </button>
        </div>
      )}
      <p className="flex gap-2 text-xs leading-relaxed text-ink-3">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Browsers can't count steps in the background. The live counter uses your phone's motion sensor only while this screen is open, and
        results are approximate. For all-day totals, enter the count from your phone's health app or wearable.
      </p>
    </section>
  );
}

export default function ActivityPage() {
  const [date, setDate] = useState(todayKey());
  const { data, isLoading } = useActivities(date);
  const profile = useProfile();
  const units = useUnits();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const weightKg = profile.data?.profile?.weightKg ?? 70;
  const items = data?.items ?? [];
  const totalMin = items.reduce((t, a) => t + a.durationMin, 0);
  const totalKcal = items.reduce((t, a) => t + a.caloriesBurned, 0);

  return (
    <div>
      <PageHeader
        title="Activity"
        subtitle={`${fmtDuration(totalMin)} active · ${fmtNum(totalKcal)} kcal burned (est.)`}
        action={
          <div className="flex gap-2">
            <DateNav value={date} onChange={setDate} />
            <button className="btn-primary" onClick={() => setOpen(true)} aria-label="Log activity">
              <Plus className="size-4" /> <span className="hidden sm:inline">Log activity</span>
            </button>
          </div>
        }
      />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {date === todayKey() && <GpsCard weightKg={weightKg} />}
          <section className="card">
            <h2 className="mb-2 font-display font-semibold">Workouts</h2>
            {isLoading ? (
              <PageLoader />
            ) : items.length === 0 ? (
              <EmptyState icon={<ActivityIcon className="size-5" />} title="No activities logged">
                <button className="mt-2 font-semibold text-green" onClick={() => setOpen(true)}>
                  Log your first one
                </button>
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((a) => {
                  const meta = activityMeta(a.type);
                  return (
                    <li key={a.id} className="flex items-center gap-3 py-3">
                      <span className="grid size-11 place-items-center rounded-xl bg-green/10 text-green">
                        <meta.icon className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 font-medium">
                          {a.name}
                          {a.source === "gps" && <span className="rounded-full bg-card-2 px-2 py-0.5 text-[10px] text-ink-2">GPS</span>}
                          {a.pending && <PendingBadge />}
                        </div>
                        <div className="text-xs text-ink-3">
                          {fmtTime(a.startTime)} · {fmtDuration(a.durationMin)}
                          {a.distanceKm ? ` · ${fmtDistance(a.distanceKm, units)}` : ""}
                          {a.avgPaceMinKm ? ` · ${fmtPace(a.avgPaceMinKm, units)}` : ""}
                        </div>
                        {a.notes && <div className="mt-0.5 truncate text-xs text-ink-2">{a.notes}</div>}
                      </div>
                      <div className="text-right font-display font-semibold tabular-nums">
                        {fmtNum(a.caloriesBurned)}
                        <div className="text-[10px] font-normal text-ink-3">kcal</div>
                      </div>
                      <button
                        className="p-1.5 text-ink-3 hover:text-danger"
                        aria-label={`Delete ${a.name}`}
                        onClick={async () => {
                          try {
                            const r = await deleteRecord(qc, "activity", a);
                            toast.show(r.queued ? "Deleted offline — will sync later" : "Activity deleted", "success");
                          } catch (e) {
                            toast.show((e as Error).message, "error");
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
        <div className="space-y-5">
          <StepsCard date={date} stepTarget={profile.data?.goals?.stepTarget ?? 10000} />
          <section className="card text-xs leading-relaxed text-ink-3">
            <b className="text-ink-2">Wearables & health apps:</b> direct sync with Apple Health, Google Health Connect and wearables isn't available
            to web apps. Copy totals from those apps into manual entry, including calories from your watch.
          </section>
        </div>
      </div>
      <ManualActivityModal key={open ? "open" : "closed"} open={open} onClose={() => setOpen(false)} date={date} weightKg={weightKg} />
    </div>
  );
}
