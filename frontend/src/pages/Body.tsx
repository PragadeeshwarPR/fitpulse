import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Plus, Ruler, Scale, Target, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { useBody, useProfile, useUnits } from "../hooks/useData";
import { api } from "../services/api";
import { useToast } from "../context/ToastContext";
import { EmptyState, Field, Modal, PageHeader, Spinner, Stat } from "../components/ui";
import { AXIS, ChartCard, ChartTooltip, GRID, Legend } from "../components/charts/ChartKit";
import { cmToDisplay, displayToCm, displayToKg, fmtNum, fmtWeight, kgToDisplay, lengthUnit, toLocalInput, weightUnit } from "../utils/format";

function MeasureModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const units = useUnits();
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ measuredAt: toLocalInput(new Date()), weight: "", waist: "", chest: "", hip: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const num = (v: string, conv: (n: number) => number) => (v ? Math.round(conv(Number(v)) * 10) / 10 : null);
  const any = f.weight || f.waist || f.chest || f.hip;

  return (
    <Modal open={open} onClose={onClose} title="New measurement">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await api<{ unlocked: Array<{ title: string }> }>("/body", {
              method: "POST",
              json: {
                measuredAt: new Date(f.measuredAt).toISOString(),
                weightKg: num(f.weight, (n) => displayToKg(n, units)),
                waistCm: num(f.waist, (n) => displayToCm(n, units)),
                chestCm: num(f.chest, (n) => displayToCm(n, units)),
                hipCm: num(f.hip, (n) => displayToCm(n, units)),
                notes: f.notes || null,
              },
            });
            for (const k of ["body", "profile", "dashboard", "analytics"]) qc.invalidateQueries({ queryKey: [k] });
            r.unlocked.forEach((a) => toast.achievement(a.title));
            toast.show("Measurement saved", "success");
            onClose();
          } catch (err) {
            toast.show((err as Error).message, "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Date & time" type="datetime-local" value={f.measuredAt} onChange={set("measuredAt")} />
        <Field label={`Weight (${weightUnit(units)})`} type="number" step="0.1" inputMode="decimal" value={f.weight} onChange={set("weight")} />
        <div className="grid grid-cols-3 gap-3">
          <Field label={`Waist (${lengthUnit(units)})`} type="number" step="0.1" value={f.waist} onChange={set("waist")} />
          <Field label={`Chest (${lengthUnit(units)})`} type="number" step="0.1" value={f.chest} onChange={set("chest")} />
          <Field label={`Hip (${lengthUnit(units)})`} type="number" step="0.1" value={f.hip} onChange={set("hip")} />
        </div>
        <Field label="Notes" value={f.notes} onChange={set("notes")} />
        <button className="btn-primary w-full" disabled={busy || !any || !navigator.onLine}>
          {busy ? <Spinner className="size-4 text-on-green" /> : navigator.onLine ? "Save" : "Connect to save measurements"}
        </button>
      </form>
    </Modal>
  );
}

export default function Body() {
  const { data } = useBody();
  const profile = useProfile();
  const units = useUnits();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const goals = profile.data?.goals;
  const items = data?.items ?? [];
  const weights = useMemo(() => items.filter((m) => m.weightKg != null).slice().reverse(), [items]);
  const current = profile.data?.profile?.weightKg ?? null;

  const change = (days: number) => {
    if (weights.length < 2) return null;
    const cutoff = Date.now() - days * 86_400_000;
    const base = weights.find((w) => Date.parse(w.measuredAt) >= cutoff) ?? weights[0];
    const last = weights.at(-1)!;
    return base === last ? null : last.weightKg! - base.weightKg!;
  };
  const wk = change(7);
  const mo = change(30);
  const fmtChange = (v: number | null) => (v == null ? "–" : `${v > 0 ? "+" : ""}${fmtNum(kgToDisplay(v, units), 1)} ${weightUnit(units)}`);

  const chart = weights.map((w) => ({
    label: new Date(w.measuredAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    weight: Math.round(kgToDisplay(w.weightKg!, units) * 10) / 10,
  }));

  return (
    <div>
      <PageHeader
        title="Body measurements"
        action={
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Add measurement
          </button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat icon={<Scale className="size-4" />} label="Current" value={fmtWeight(current, units)} />
        <Stat icon={<Target className="size-4" />} label="Target" value={fmtWeight(goals?.targetWeightKg, units)} sub={current && goals ? `${fmtWeight(Math.abs(current - goals.targetWeightKg), units)} to go` : undefined} />
        <Stat icon={<Ruler className="size-4" />} label="BMI" value={goals?.bmi.toFixed(1) ?? "–"} sub={profile.data?.bmiCategory ?? undefined} />
        <Stat icon={wk != null && wk > 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />} label="This week" value={fmtChange(wk)} />
        <Stat icon={mo != null && mo > 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />} label="This month" value={fmtChange(mo)} />
      </div>

      <ChartCard
        className="mt-5"
        title="Weight trend"
        legend={
          <Legend
            items={[
              { label: "Weight", color: "var(--green)" },
              { label: "Target", color: "var(--text-3)", dashed: true },
            ]}
          />
        }
      >
        {chart.length < 2 ? (
          <EmptyState icon={<Scale className="size-5" />} title="Add two or more weigh-ins to see your trend" />
        ) : (
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={chart} margin={{ left: -8, right: 8, top: 8 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" />
                <YAxis {...AXIS} width={44} domain={["dataMin - 2", "dataMax + 2"]} tickFormatter={(v) => fmtNum(v, 0)} />
                <Tooltip content={<ChartTooltip format={(v) => `${fmtNum(v, 1)} ${weightUnit(units)}`} />} />
                {goals && <ReferenceLine y={Math.round(kgToDisplay(goals.targetWeightKg, units) * 10) / 10} stroke="var(--text-3)" strokeDasharray="4 4" />}
                <Line type="monotone" dataKey="weight" name="Weight" stroke="var(--green)" strokeWidth={2} dot={{ r: 4, fill: "var(--green)", stroke: "var(--card)", strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <section className="card mt-5 overflow-x-auto">
        <h2 className="mb-3 font-display font-semibold">History</h2>
        {items.length === 0 ? (
          <EmptyState icon={<Ruler className="size-5" />} title="No measurements yet" />
        ) : (
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-left text-xs text-ink-3 uppercase">
              <tr>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Weight</th>
                <th className="pb-2 font-medium">BMI</th>
                <th className="pb-2 font-medium">Waist</th>
                <th className="pb-2 font-medium">Chest</th>
                <th className="pb-2 font-medium">Hip</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((m) => (
                <tr key={m.id}>
                  <td className="py-2.5">{new Date(m.measuredAt).toLocaleDateString()}</td>
                  <td className="tabular-nums">{fmtWeight(m.weightKg, units)}</td>
                  <td className="tabular-nums">{m.bmi?.toFixed(1) ?? "–"}</td>
                  {[m.waistCm, m.chestCm, m.hipCm].map((v, i) => (
                    <td key={i} className="tabular-nums">
                      {v ? `${fmtNum(cmToDisplay(v, units), 1)} ${lengthUnit(units)}` : "–"}
                    </td>
                  ))}
                  <td className="text-right">
                    <button
                      className="p-1 text-ink-3 hover:text-danger"
                      aria-label="Delete measurement"
                      onClick={async () => {
                        await api(`/body/${m.id}`, { method: "DELETE" }).catch((e) => toast.show((e as Error).message, "error"));
                        qc.invalidateQueries({ queryKey: ["body"] });
                      }}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <MeasureModal key={open ? "o" : "c"} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
