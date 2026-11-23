import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, CalendarCheck, Droplet, Flame, Footprints, Moon, Scale, Table2, Utensils } from "lucide-react";
import { api } from "../services/api";
import { useUnits } from "../hooks/useData";
import { PageHeader, PageLoader, Segmented, Stat } from "../components/ui";
import { AXIS, ChartCard, ChartTooltip, GRID, Legend, compactTick, domainWithGoal } from "../components/charts/ChartKit";
import { fmtDistance, fmtDuration, fmtNum, fmtWeight, fromKey, kgToDisplay, shiftDate, todayKey, weightUnit } from "../utils/format";
import type { DaySummary, Goals, Summary } from "../utils/types";

type Range = "day" | "7" | "30" | "90" | "custom";
type Resp = {
  series: DaySummary[];
  summary: Summary;
  goals: Goals | null;
  goalCompletion: { stepDays: number; waterDays: number; sleepDays: number; calorieDays: number; proteinDays: number } | null;
  weights: Array<{ measuredAt: string; weightKg: number }>;
};

export default function Analytics() {
  const units = useUnits();
  const [range, setRange] = useState<Range>("7");
  const [custom, setCustom] = useState({ from: shiftDate(todayKey(), -13), to: todayKey() });
  const [showTable, setShowTable] = useState(false);
  const { from, to } =
    range === "custom" ? custom : range === "day" ? { from: todayKey(), to: todayKey() } : { from: shiftDate(todayKey(), -(Number(range) - 1)), to: todayKey() };

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", from, to],
    queryFn: () => api<Resp>(`/analytics?from=${from}&to=${to}`),
    enabled: from <= to,
  });

  const days = data?.series.length ?? 0;
  const chart = useMemo(
    () =>
      (data?.series ?? []).map((d) => ({
        ...d,
        label: fromKey(d.date).toLocaleDateString(undefined, days > 14 ? { month: "short", day: "numeric" } : { weekday: "short", day: "numeric" }),
        sleepH: Math.round((d.sleepMin / 60) * 10) / 10,
        waterL: d.waterMl / 1000,
      })),
    [data, days],
  );
  const weightChart = (data?.weights ?? []).map((w) => ({
    label: new Date(w.measuredAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    weight: Math.round(kgToDisplay(w.weightKg, units) * 10) / 10,
  }));

  const s = data?.summary;
  const g = data?.goals;
  const today = data?.series.at(-1);

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle={range === "day" ? "Today" : `${fromKey(from).toLocaleDateString()} – ${fromKey(to).toLocaleDateString()}`}
        action={
          <Segmented<Range>
            label="Date range"
            value={range}
            onChange={setRange}
            options={[
              { value: "day", label: "Day" },
              { value: "7", label: "Week" },
              { value: "30", label: "Month" },
              { value: "90", label: "90d" },
              { value: "custom", label: "Custom" },
            ]}
          />
        }
      />
      {range === "custom" && (
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <label>
            <span className="label">From</span>
            <input type="date" className="input" value={custom.from} max={custom.to} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
          </label>
          <label>
            <span className="label">To</span>
            <input type="date" className="input" value={custom.to} min={custom.from} max={todayKey()} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
          </label>
        </div>
      )}

      {isLoading || !s ? (
        <PageLoader />
      ) : range === "day" && today ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat icon={<Utensils className="size-4" />} label="Calories in" value={fmtNum(today.caloriesIn)} sub={g ? `Target ${fmtNum(g.dailyCalorieTarget)}` : undefined} />
          <Stat icon={<Flame className="size-4" />} label="Calories burned" value={fmtNum(today.caloriesOut)} />
          <Stat icon={<Footprints className="size-4" />} label="Steps" value={fmtNum(today.steps)} />
          <Stat icon={<Activity className="size-4" />} label="Distance" value={fmtDistance(today.distanceKm, units)} />
          <Stat icon={<Activity className="size-4" />} label="Active minutes" value={fmtDuration(today.activeMin)} />
          <Stat icon={<Droplet className="size-4" />} label="Water" value={`${fmtNum(today.waterMl / 1000, 2)} L`} />
          <Stat icon={<Moon className="size-4" />} label="Sleep" value={today.sleepMin ? fmtDuration(today.sleepMin) : "–"} />
          <Stat icon={<Utensils className="size-4" />} label="Protein" value={`${fmtNum(today.proteinG)} g`} />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat icon={<Footprints className="size-4" />} label="Avg steps" value={fmtNum(s.avgSteps)} sub={`${fmtNum(s.totalSteps)} total · ${fmtDistance(s.totalDistanceKm, units)}`} />
            <Stat icon={<Utensils className="size-4" />} label="Avg intake" value={`${fmtNum(s.avgCaloriesIn)} kcal`} sub={`${s.foodLoggedDays}/${s.days} days logged`} />
            <Stat icon={<Activity className="size-4" />} label="Workouts" value={fmtDuration(s.totalActiveMin)} sub={`${s.totalWorkouts} sessions · ${s.activeDays} active days`} />
            <Stat
              icon={<Scale className="size-4" />}
              label="Weight change"
              value={s.weightChangeKg == null ? "–" : `${s.weightChangeKg > 0 ? "+" : ""}${fmtNum(kgToDisplay(s.weightChangeKg, units), 1)} ${weightUnit(units)}`}
              sub={s.weightEnd ? `Now ${fmtWeight(s.weightEnd, units)}` : "Log weigh-ins in Body"}
            />
            <Stat icon={<Utensils className="size-4" />} label="Avg protein" value={`${fmtNum(s.avgProteinG)} g`} sub={g ? `Target ${g.proteinTargetG} g` : undefined} />
            <Stat icon={<Flame className="size-4" />} label="Avg burned" value={`${fmtNum(s.avgCaloriesOut)} kcal`} />
            <Stat icon={<Droplet className="size-4" />} label="Avg water" value={`${fmtNum(s.avgWaterMl / 1000, 2)} L`} />
            <Stat icon={<Moon className="size-4" />} label="Avg sleep" value={s.avgSleepMin ? fmtDuration(s.avgSleepMin) : "–"} sub={s.avgSleepMin ? `±${fmtDuration(s.sleepConsistencyMin)} night-to-night` : undefined} />
          </div>

          {data.goalCompletion && (
            <section className="card">
              <h3 className="mb-3 flex items-center gap-2 font-display font-semibold">
                <CalendarCheck className="size-4 text-green" /> Goal completion
              </h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                {[
                  ["Step goal", data.goalCompletion.stepDays],
                  ["Calories ±10%", data.goalCompletion.calorieDays],
                  ["Protein goal", data.goalCompletion.proteinDays],
                  ["Water goal", data.goalCompletion.waterDays],
                  ["Sleep goal", data.goalCompletion.sleepDays],
                ].map(([label, n]) => (
                  <div key={String(label)}>
                    <div className="font-display text-2xl font-bold">
                      {n}
                      <span className="text-sm font-normal text-ink-3">/{days}</span>
                    </div>
                    <div className="mb-1.5 text-xs text-ink-2">{label} days</div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-card-2">
                      <div className="h-full rounded-full bg-green" style={{ width: `${(Number(n) / days) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard
              title="Calories"
              subtitle="Consumed vs. burned per day"
              legend={
                <Legend
                  items={[
                    { label: "Consumed", color: "var(--series-1)" },
                    { label: "Burned", color: "var(--series-2)" },
                    ...(g ? [{ label: "Target", color: "var(--text-3)", dashed: true }] : []),
                  ]}
                />
              }
            >
              <div className="h-60">
                <ResponsiveContainer>
                  <LineChart data={chart} margin={{ left: -12, right: 4, top: 8 }}>
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={16} />
                    <YAxis {...AXIS} width={40} tickFormatter={compactTick} domain={domainWithGoal(g?.dailyCalorieTarget)} />
                    <Tooltip content={<ChartTooltip format={(v) => `${fmtNum(v)} kcal`} />} />
                    {g && <ReferenceLine y={g.dailyCalorieTarget} stroke="var(--text-3)" strokeDasharray="4 4" />}
                    <Line dataKey="caloriesIn" name="Consumed" stroke="var(--series-1)" strokeWidth={2} dot={days <= 14 ? { r: 3 } : false} />
                    <Line dataKey="caloriesOut" name="Burned" stroke="var(--series-2)" strokeWidth={2} dot={days <= 14 ? { r: 3 } : false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard
              title="Macronutrients"
              subtitle="Grams per day"
              legend={
                <Legend
                  items={[
                    { label: "Protein", color: "var(--series-1)" },
                    { label: "Carbs", color: "var(--series-2)" },
                    { label: "Fat", color: "var(--series-3)" },
                  ]}
                />
              }
            >
              <div className="h-60">
                <ResponsiveContainer>
                  <BarChart data={chart} margin={{ left: -12, right: 4, top: 8 }}>
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={16} />
                    <YAxis {...AXIS} width={40} tickFormatter={compactTick} />
                    <Tooltip cursor={{ fill: "var(--card-2)" }} content={<ChartTooltip format={(v) => `${fmtNum(v)} g`} />} />
                    {/* 2px surface gap between stacked segments */}
                    <Bar dataKey="proteinG" name="Protein" stackId="m" fill="var(--series-1)" stroke="var(--card)" strokeWidth={2} />
                    <Bar dataKey="carbsG" name="Carbs" stackId="m" fill="var(--series-2)" stroke="var(--card)" strokeWidth={2} />
                    <Bar dataKey="fatG" name="Fat" stackId="m" fill="var(--series-3)" stroke="var(--card)" strokeWidth={2} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Steps" subtitle="Daily total" legend={g ? <Legend items={[{ label: "Goal", color: "var(--text-3)", dashed: true }]} /> : undefined}>
              <div className="h-60">
                <ResponsiveContainer>
                  <BarChart data={chart} margin={{ left: -12, right: 4, top: 8 }}>
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={16} />
                    <YAxis {...AXIS} width={40} tickFormatter={compactTick} domain={domainWithGoal(g?.stepTarget)} />
                    <Tooltip cursor={{ fill: "var(--card-2)" }} content={<ChartTooltip format={(v) => `${fmtNum(v)} steps`} />} />
                    {g && <ReferenceLine y={g.stepTarget} stroke="var(--text-3)" strokeDasharray="4 4" />}
                    <Bar dataKey="steps" name="Steps" fill="var(--green)" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Active minutes" subtitle="Activity consistency">
              <div className="h-60">
                <ResponsiveContainer>
                  <BarChart data={chart} margin={{ left: -12, right: 4, top: 8 }}>
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={16} />
                    <YAxis {...AXIS} width={40} tickFormatter={compactTick} />
                    <Tooltip cursor={{ fill: "var(--card-2)" }} content={<ChartTooltip format={(v) => fmtDuration(v)} />} />
                    <Bar dataKey="activeMin" name="Active" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Sleep" subtitle="Hours per night" legend={g ? <Legend items={[{ label: "Goal", color: "var(--text-3)", dashed: true }]} /> : undefined}>
              <div className="h-60">
                <ResponsiveContainer>
                  <AreaChart data={chart} margin={{ left: -12, right: 4, top: 8 }}>
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={16} />
                    <YAxis {...AXIS} width={44} domain={[0, 12]} />
                    <Tooltip content={<ChartTooltip format={(v) => fmtDuration(v * 60)} />} />
                    {g && <ReferenceLine y={g.sleepTargetMin / 60} stroke="var(--text-3)" strokeDasharray="4 4" />}
                    <Area dataKey="sleepH" name="Sleep" stroke="var(--series-2)" strokeWidth={2} fill="var(--series-2)" fillOpacity={0.15} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Weight progression" legend={<Legend items={[{ label: "Weight", color: "var(--green)" }]} />}>
              {weightChart.length < 2 ? (
                <p className="py-16 text-center text-sm text-ink-3">Not enough weigh-ins in this period.</p>
              ) : (
                <div className="h-60">
                  <ResponsiveContainer>
                    <LineChart data={weightChart} margin={{ left: -8, right: 8, top: 8 }}>
                      <CartesianGrid {...GRID} />
                      <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" />
                      <YAxis {...AXIS} width={44} domain={["dataMin - 1", "dataMax + 1"]} tickFormatter={(v) => fmtNum(v, 0)} />
                      <Tooltip content={<ChartTooltip format={(v) => `${fmtNum(v, 1)} ${weightUnit(units)}`} />} />
                      <Line dataKey="weight" name="Weight" stroke="var(--green)" strokeWidth={2} dot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartCard>
          </div>

          <section className="card">
            <button className="flex items-center gap-2 text-sm font-medium text-ink-2 hover:text-ink" onClick={() => setShowTable(!showTable)} aria-expanded={showTable}>
              <Table2 className="size-4" /> {showTable ? "Hide" : "Show"} data table
            </button>
            {showTable && (
              <div className="mt-3 max-h-96 overflow-auto">
                <table className="w-full min-w-[640px] text-xs">
                  <thead className="sticky top-0 bg-card text-left text-ink-3 uppercase">
                    <tr>
                      {["Date", "kcal in", "kcal out", "Protein", "Carbs", "Fat", "Steps", "Active", "Water", "Sleep"].map((h) => (
                        <th key={h} className="py-2 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line tabular-nums">
                    {data.series.map((d) => (
                      <tr key={d.date}>
                        <td className="py-1.5">{d.date}</td>
                        <td>{fmtNum(d.caloriesIn)}</td>
                        <td>{fmtNum(d.caloriesOut)}</td>
                        <td>{fmtNum(d.proteinG)}</td>
                        <td>{fmtNum(d.carbsG)}</td>
                        <td>{fmtNum(d.fatG)}</td>
                        <td>{fmtNum(d.steps)}</td>
                        <td>{d.activeMin}m</td>
                        <td>{fmtNum(d.waterMl)} ml</td>
                        <td>{d.sleepMin ? fmtDuration(d.sleepMin) : "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
