import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Droplet, GlassWater, Trash2 } from "lucide-react";
import { useProfile, useWater } from "../hooks/useData";
import { api } from "../services/api";
import { createRecord, deleteRecord } from "../services/offline";
import { useToast } from "../context/ToastContext";
import { DateNav, EmptyState, PageHeader, PendingBadge, ProgressRing } from "../components/ui";
import { AXIS, ChartCard, ChartTooltip, GRID, Legend } from "../components/charts/ChartKit";
import { fmtDay, fmtNum, fmtTime, shiftDate, todayKey } from "../utils/format";
import type { DaySummary } from "../utils/types";

export default function Water() {
  const [date, setDate] = useState(todayKey());
  const { data } = useWater(date);
  const profile = useProfile();
  const qc = useQueryClient();
  const toast = useToast();
  const [custom, setCustom] = useState("");
  const target = profile.data?.goals?.waterTargetMl ?? 2500;
  const total = data?.totalMl ?? 0;

  const from = shiftDate(todayKey(), -13);
  const history = useQuery({
    queryKey: ["analytics", from, todayKey()],
    queryFn: () => api<{ series: DaySummary[] }>(`/analytics?from=${from}&to=${todayKey()}`),
  });
  const chart = useMemo(() => (history.data?.series ?? []).map((d) => ({ label: fmtDay(d.date, { day: "numeric", month: "short" }), waterL: d.waterMl / 1000 })), [history.data]);

  async function add(ml: number) {
    if (!ml || ml < 10 || ml > 5000) return toast.show("Enter between 10 and 5000 ml", "warning");
    const recordedAt = date === todayKey() ? new Date() : new Date(`${date}T12:00:00`);
    const r = await createRecord(qc, "water", { amountMl: ml, recordedAt: recordedAt.toISOString() });
    toast.show(r.queued ? `+${ml} ml saved offline` : `+${ml} ml logged`, "success");
    r.unlocked?.forEach((a) => toast.achievement(a.title));
    setCustom("");
  }

  return (
    <div>
      <PageHeader title="Hydration" subtitle={`Daily target ${fmtNum(target / 1000, 1)} L`} action={<DateNav value={date} onChange={setDate} />} />
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card flex flex-col items-center gap-6">
          <ProgressRing value={total} max={target} size={220} stroke={16} color="var(--series-2)" label="Water progress">
            <div>
              <Droplet className="mx-auto mb-1 size-6 text-[var(--series-2)]" />
              <div className="font-display text-4xl font-bold tabular-nums">{fmtNum(total / 1000, 2)}</div>
              <div className="text-xs text-ink-2">of {fmtNum(target / 1000, 1)} L</div>
            </div>
          </ProgressRing>
          <div className="grid w-full grid-cols-3 gap-3">
            {[100, 250, 500].map((ml) => (
              <button key={ml} className="btn-ghost flex-col py-4" onClick={() => add(ml)}>
                <GlassWater className="size-5 text-[var(--series-2)]" />
                +{ml} ml
              </button>
            ))}
          </div>
          <form
            className="flex w-full gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              add(Number(custom));
            }}
          >
            <input className="input" type="number" min={10} max={5000} placeholder="Custom amount (ml)" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="Custom amount in ml" />
            <button className="btn-primary shrink-0" disabled={!custom}>
              Add
            </button>
          </form>
        </section>

        <section className="card">
          <h2 className="mb-2 font-display font-semibold">Log</h2>
          {(data?.items ?? []).length === 0 ? (
            <EmptyState icon={<Droplet className="size-5" />} title="No water logged" />
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {data!.items.map((w) => (
                <li key={w.id} className="flex items-center gap-3 py-2.5">
                  <GlassWater className="size-4 text-[var(--series-2)]" />
                  <span className="flex-1 text-sm">
                    {w.amountMl} ml {w.pending && <PendingBadge />}
                  </span>
                  <span className="text-xs text-ink-3">{fmtTime(w.recordedAt)}</span>
                  <button
                    className="p-1 text-ink-3 hover:text-danger"
                    aria-label="Delete"
                    onClick={() => deleteRecord(qc, "water", w).catch((e) => toast.show((e as Error).message, "error"))}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <ChartCard className="mt-5" title="Last 14 days" legend={<Legend items={[{ label: "Target", color: "var(--text-3)", dashed: true }]} />}>
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={chart} margin={{ left: -12, right: 4, top: 8 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" />
              <YAxis {...AXIS} width={40} unit=" L" />
              <Tooltip cursor={{ fill: "var(--card-2)" }} content={<ChartTooltip format={(v) => `${fmtNum(v, 2)} L`} />} />
              <ReferenceLine y={target / 1000} stroke="var(--text-3)" strokeDasharray="4 4" />
              <Bar dataKey="waterL" name="Water" fill="var(--series-2)" radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
}
