import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import clsx from "clsx";
import { Moon, Plus, Star, Sun, Trash2 } from "lucide-react";
import { useProfile, useSleep } from "../hooks/useData";
import { api } from "../services/api";
import { createRecord, deleteRecord } from "../services/offline";
import { useToast } from "../context/ToastContext";
import { EmptyState, Field, Modal, PageHeader, PendingBadge, Spinner, Stat } from "../components/ui";
import { AXIS, ChartCard, ChartTooltip, GRID, Legend } from "../components/charts/ChartKit";
import { fmtDay, fmtDuration, fmtTime, shiftDate, toLocalInput, todayKey } from "../utils/format";
import type { DaySummary, SleepRecord } from "../utils/types";

const QUALITY = ["Very poor", "Poor", "Fair", "Good", "Excellent"];

function SleepModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const now = new Date();
  const defaultEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0);
  const defaultStart = new Date(defaultEnd.getTime() - 8 * 3_600_000);
  const [start, setStart] = useState(toLocalInput(defaultStart));
  const [end, setEnd] = useState(toLocalInput(defaultEnd));
  const [quality, setQuality] = useState(4);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const durationMin = Math.round((Date.parse(end) - Date.parse(start)) / 60_000);
  const invalid = !(durationMin > 0 && durationMin <= 20 * 60);

  return (
    <Modal open={open} onClose={onClose} title="Log sleep">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await createRecord(qc, "sleep", {
              sleepStart: new Date(start).toISOString(),
              sleepEnd: new Date(end).toISOString(),
              quality,
              notes: notes.trim() || null,
            });
            toast.show(r.queued ? "Sleep saved offline" : "Sleep logged", "success");
            r.unlocked?.forEach((a) => toast.achievement(a.title));
            onClose();
          } catch (err) {
            toast.show((err as Error).message, "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Fell asleep" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
        <Field
          label="Woke up"
          type="datetime-local"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          required
          error={invalid ? "Wake-up must be after sleep time (max 20 h)" : undefined}
          hint={!invalid ? `Total: ${fmtDuration(durationMin)}` : undefined}
        />
        <div>
          <span className="label">Sleep quality: {QUALITY[quality - 1]}</span>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((q) => (
              <button type="button" key={q} onClick={() => setQuality(q)} aria-label={`${q} - ${QUALITY[q - 1]}`} aria-pressed={quality === q}>
                <Star className={clsx("size-8", q <= quality ? "fill-green text-green" : "text-ink-3")} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="sleep-notes">
            Notes
          </label>
          <textarea id="sleep-notes" className="input min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Caffeine late? Woke up at night?" />
        </div>
        <button className="btn-primary w-full" disabled={busy || invalid}>
          {busy ? <Spinner className="size-4 text-on-green" /> : "Save sleep"}
        </button>
      </form>
    </Modal>
  );
}

export default function Sleep() {
  const { data } = useSleep();
  const profile = useProfile();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const targetMin = profile.data?.goals?.sleepTargetMin ?? 480;
  const from = shiftDate(todayKey(), -6);
  const week = useQuery({
    queryKey: ["analytics", from, todayKey()],
    queryFn: () => api<{ series: DaySummary[]; summary: { avgSleepMin: number; sleepConsistencyMin: number } }>(`/analytics?from=${from}&to=${todayKey()}`),
  });
  const items = data?.items ?? [];
  const latest = items[0];

  const stats = useMemo(() => {
    const recent = items.filter((s) => Date.parse(s.sleepEnd) > Date.now() - 7 * 86_400_000);
    // Bedtime consistency: spread of sleep start times (minutes from 6pm).
    const starts = recent.map((s) => {
      const d = new Date(s.sleepStart);
      return ((d.getHours() + 6) % 24) * 60 + d.getMinutes();
    });
    const mean = starts.reduce((a, b) => a + b, 0) / (starts.length || 1);
    const sd = Math.sqrt(starts.reduce((t, x) => t + (x - mean) ** 2, 0) / (starts.length || 1));
    const avgQ = recent.reduce((t, s) => t + s.quality, 0) / (recent.length || 1);
    return { count: recent.length, bedtimeSd: Math.round(sd), avgQuality: avgQ };
  }, [items]);

  const insight = useMemo(() => {
    const avg = week.data?.summary.avgSleepMin ?? 0;
    if (stats.count < 3) return "Log at least 3 nights to unlock consistency insights.";
    const parts: string[] = [];
    if (avg < targetMin - 30) parts.push(`You're averaging ${fmtDuration(avg)}, ${fmtDuration(targetMin - avg)} below your goal. Try going to bed 20–30 minutes earlier.`);
    else parts.push(`Nice! You're averaging ${fmtDuration(avg)}, close to your ${fmtDuration(targetMin)} goal.`);
    if (stats.bedtimeSd > 60) parts.push(`Your bedtime varies by about ±${fmtDuration(stats.bedtimeSd)}. A consistent schedule improves sleep quality.`);
    else parts.push("Your bedtime is consistent. Keep it up.");
    return parts.join(" ");
  }, [week.data, stats, targetMin]);

  const chart = (week.data?.series ?? []).map((d) => ({ label: fmtDay(d.date), hours: Math.round((d.sleepMin / 60) * 10) / 10 }));

  return (
    <div>
      <PageHeader
        title="Sleep"
        subtitle={`Goal ${fmtDuration(targetMin)} per night`}
        action={
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Log sleep
          </button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Moon className="size-4" />} label="Last night" value={latest ? fmtDuration(latest.durationMin) : "–"} sub={latest ? `${fmtTime(latest.sleepStart)} → ${fmtTime(latest.sleepEnd)}` : undefined} />
        <Stat icon={<Sun className="size-4" />} label="7-day average" value={week.data?.summary.avgSleepMin ? fmtDuration(week.data.summary.avgSleepMin) : "–"} />
        <Stat icon={<Star className="size-4" />} label="Avg quality" value={stats.count ? `${stats.avgQuality.toFixed(1)}/5` : "–"} />
        <Stat icon={<Moon className="size-4" />} label="Bedtime spread" value={stats.count >= 2 ? `±${fmtDuration(stats.bedtimeSd)}` : "–"} sub="Lower is more consistent" />
      </div>
      <div className="mt-5 rounded-2xl border border-green/30 bg-green/5 p-4 text-sm">{insight}</div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ChartCard title="Weekly sleep" subtitle="Hours per night (attributed to the day you woke up)" legend={<Legend items={[{ label: "Goal", color: "var(--text-3)", dashed: true }]} />}>
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={chart} margin={{ left: -12, right: 4, top: 8 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="label" {...AXIS} />
                <YAxis {...AXIS} width={40} domain={[0, 12]} unit="h" />
                <Tooltip cursor={{ fill: "var(--card-2)" }} content={<ChartTooltip format={(v) => fmtDuration(v * 60)} />} />
                <ReferenceLine y={targetMin / 60} stroke="var(--text-3)" strokeDasharray="4 4" />
                <Bar dataKey="hours" name="Sleep" fill="var(--series-2)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <section className="card">
          <h2 className="mb-2 font-display font-semibold">History</h2>
          {items.length === 0 ? (
            <EmptyState icon={<Moon className="size-5" />} title="No sleep logged yet" />
          ) : (
            <ul className="max-h-72 divide-y divide-line overflow-y-auto">
              {items.map((s: SleepRecord) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {new Date(s.sleepEnd).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} {s.pending && <PendingBadge />}
                    </div>
                    <div className="text-xs text-ink-3">
                      {fmtTime(s.sleepStart)} → {fmtTime(s.sleepEnd)} · {QUALITY[s.quality - 1]}
                      {s.notes ? ` · ${s.notes}` : ""}
                    </div>
                  </div>
                  <span className="font-display font-semibold">{fmtDuration(s.durationMin)}</span>
                  <button className="p-1 text-ink-3 hover:text-danger" aria-label="Delete" onClick={() => deleteRecord(qc, "sleep", s).catch((e) => toast.show((e as Error).message, "error"))}>
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <SleepModal key={open ? "o" : "c"} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
