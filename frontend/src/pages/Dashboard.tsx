import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Clock, Droplet, Flame, Footprints, Moon, Plus, Route, ScanLine, Sparkles, Utensils } from "lucide-react";
import { useDashboard, useUnits } from "../hooks/useData";
import { api } from "../services/api";
import { createRecord } from "../services/offline";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { DateNav, EmptyState, PageLoader, PendingBadge, ProgressBar, ProgressRing, Stat } from "../components/ui";
import { AXIS, ChartCard, ChartTooltip, GRID, Legend, compactTick, domainWithGoal } from "../components/charts/ChartKit";
import { activityMeta } from "../utils/activities";
import { fmtDay, fmtDistance, fmtDuration, fmtNum, fmtTime, todayKey } from "../utils/format";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function Dashboard() {
  const [date, setDate] = useState(todayKey());
  const { user } = useAuth();
  const { data, isLoading, error } = useDashboard(date);
  const units = useUnits();
  const qc = useQueryClient();
  const toast = useToast();
  // The AI insight is fetched on request only, so opening the dashboard never uses up AI quota.
  const [wantInsight, setWantInsight] = useState(false);
  const insight = useQuery({
    queryKey: ["insight", todayKey()],
    queryFn: () => api<{ insight: string | null }>("/ai/insight"),
    staleTime: 6 * 3_600_000,
    retry: false,
    enabled: wantInsight && date === todayKey(),
  });

  if (isLoading) return <PageLoader />;
  if (!data) return <EmptyState icon={<Flame />} title="Couldn't load your dashboard">{(error as Error)?.message ?? "Connect to the internet to load today's data."}</EmptyState>;

  const { today, goals } = data;
  const target = goals?.dailyCalorieTarget ?? 2000;
  const remaining = data.remainingCalories ?? target - today.caloriesIn + today.caloriesOut;
  const budget = target + today.caloriesOut;

  async function quickWater(ml: number) {
    const r = await createRecord(qc, "water", { amountMl: ml, recordedAt: new Date().toISOString() });
    toast.show(r.queued ? `+${ml} ml saved offline` : `+${ml} ml water logged`, "success");
    r.unlocked?.forEach((a) => toast.achievement(a.title));
  }

  const weekChart = data.week.map((d) => ({ ...d, label: fmtDay(d.date) }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-2">{greeting()},</p>
          <h1 className="heading">{user?.fullName.split(" ")[0]} 👋</h1>
        </div>
        <DateNav value={date} onChange={setDate} />
      </div>

      {date === todayKey() && !insight.data?.insight && (
        <button className="btn-ghost w-full justify-start" onClick={() => setWantInsight(true)} disabled={insight.isFetching}>
          <Sparkles className="size-4 text-green" />
          {insight.isFetching ? "Thinking…" : insight.isError ? `${(insight.error as Error).message} Tap to retry.` : "Get today's AI insight"}
        </button>
      )}
      {insight.data?.insight && (
        <div className="animate-rise flex items-start gap-3 rounded-2xl border border-green/30 bg-green/5 p-4">
          <Sparkles className="mt-0.5 size-5 shrink-0 text-green" />
          <p className="text-sm">
            <span className="font-semibold text-green">AI insight · </span>
            {insight.data.insight}
          </p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Calorie ring */}
        <section className="card flex flex-col items-center gap-5 sm:flex-row lg:col-span-3">
          <ProgressRing value={today.caloriesIn} max={budget} label="Calories consumed of budget" size={190}>
            <div>
              <div className="font-display text-4xl font-bold tabular-nums">{fmtNum(Math.abs(remaining))}</div>
              <div className="text-xs text-ink-2">{remaining >= 0 ? "kcal remaining" : "kcal over"}</div>
            </div>
          </ProgressRing>
          <div className="grid w-full flex-1 grid-cols-3 gap-3 sm:grid-cols-1">
            <div className="rounded-2xl bg-card-2 p-3">
              <div className="flex items-center gap-1.5 text-xs text-ink-2">
                <Utensils className="size-3.5" /> Consumed
              </div>
              <div className="font-display text-xl font-bold tabular-nums">{fmtNum(today.caloriesIn)}</div>
            </div>
            <div className="rounded-2xl bg-card-2 p-3">
              <div className="flex items-center gap-1.5 text-xs text-ink-2">
                <Flame className="size-3.5" /> Burned
              </div>
              <div className="font-display text-xl font-bold tabular-nums">{fmtNum(today.caloriesOut)}</div>
            </div>
            <div className="rounded-2xl bg-card-2 p-3">
              <div className="text-xs text-ink-2">Target</div>
              <div className="font-display text-xl font-bold tabular-nums">{fmtNum(target)}</div>
            </div>
          </div>
        </section>

        {/* Macros */}
        <section className="card space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold">Nutrition</h2>
            <Link to="/food" className="text-xs font-medium text-green">
              Food diary →
            </Link>
          </div>
          <ProgressBar label="Protein" value={today.proteinG} max={goals?.proteinTargetG ?? 100} />
          <ProgressBar label="Carbs" value={today.carbsG} max={goals?.carbsTargetG ?? 250} />
          <ProgressBar label="Fat" value={today.fatG} max={goals?.fatTargetG ?? 65} />
          <ProgressBar label="Fibre" value={today.fiberG} max={goals?.fiberTargetG ?? 30} />
        </section>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Stat
          icon={<Footprints className="size-4" />}
          label="Steps"
          value={fmtNum(today.steps)}
          sub={
            <div className="space-y-1.5">
              <div className="h-1.5 overflow-hidden rounded-full bg-card-2">
                <div className="h-full rounded-full bg-green" style={{ width: `${Math.min(100, (today.steps / (goals?.stepTarget ?? 10000)) * 100)}%` }} />
              </div>
              of {fmtNum(goals?.stepTarget ?? 10000)}
            </div>
          }
        />
        <Stat icon={<Route className="size-4" />} label="Distance" value={fmtDistance(today.distanceKm, units)} />
        <Stat icon={<Clock className="size-4" />} label="Active" value={fmtDuration(today.activeMin)} sub={`${today.workouts} workout${today.workouts === 1 ? "" : "s"}`} />
        <Stat
          icon={<Droplet className="size-4" />}
          label="Water"
          value={`${fmtNum(today.waterMl / 1000, 2)} L`}
          sub={
            date === todayKey() ? (
              <div className="flex gap-1.5">
                {[250, 500].map((ml) => (
                  <button key={ml} onClick={() => quickWater(ml)} className="chip px-2 py-0.5 text-[11px]">
                    +{ml}
                  </button>
                ))}
              </div>
            ) : (
              `of ${fmtNum((goals?.waterTargetMl ?? 2500) / 1000, 1)} L`
            )
          }
        />
        <Stat
          icon={<Moon className="size-4" />}
          label="Sleep"
          value={today.sleepMin ? fmtDuration(today.sleepMin) : "–"}
          sub={today.sleepQuality ? `Quality ${today.sleepQuality}/5` : <Link to="/sleep" className="text-green">Log sleep</Link>}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Calories in vs. burned"
          subtitle="Last 7 days"
          legend={
            <Legend
              items={[
                { label: "Consumed", color: "var(--series-1)" },
                { label: "Burned", color: "var(--series-2)" },
              ]}
            />
          }
        >
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={weekChart} barGap={2} margin={{ left: -12, right: 4, top: 8 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="label" {...AXIS} />
                <YAxis {...AXIS} width={40} tickFormatter={compactTick} />
                <Tooltip cursor={{ fill: "var(--card-2)" }} content={<ChartTooltip format={(v) => `${fmtNum(v)} kcal`} />} />
                <Bar dataKey="caloriesIn" name="Consumed" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={18} />
                <Bar dataKey="caloriesOut" name="Burned" fill="var(--series-2)" radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Weekly steps"
          subtitle={`Avg ${fmtNum(data.weekSummary.avgSteps)} / day · ${data.weekSummary.activeDays} active days`}
          legend={<Legend items={[{ label: "Goal", color: "var(--text-3)", dashed: true }]} />}
        >
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={weekChart} margin={{ left: -12, right: 4, top: 8 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="label" {...AXIS} />
                <YAxis {...AXIS} width={40} tickFormatter={compactTick} domain={domainWithGoal(goals?.stepTarget ?? 10000)} />
                <Tooltip cursor={{ fill: "var(--card-2)" }} content={<ChartTooltip format={(v) => `${fmtNum(v)} steps`} />} />
                <ReferenceLine y={goals?.stepTarget ?? 10000} stroke="var(--text-3)" strokeDasharray="4 4" />
                <Bar dataKey="steps" name="Steps" fill="var(--green)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display font-semibold">Activities</h2>
          <Link to="/activity" className="btn-ghost px-3 py-1.5 text-xs">
            <Plus className="size-3.5" /> Add
          </Link>
        </div>
        {data.activities.length === 0 ? (
          <EmptyState icon={<Flame className="size-5" />} title="No activities yet">
            Log a workout or start a GPS session.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {data.activities.map((a) => {
              const meta = activityMeta(a.type);
              const Icon = meta.icon;
              return (
                <li key={a.id} className="flex items-center gap-3 py-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-green/10 text-green">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-medium">
                      {a.name} {a.pending && <PendingBadge />}
                    </div>
                    <div className="text-xs text-ink-3">
                      {fmtTime(a.startTime)} · {fmtDuration(a.durationMin)}
                      {a.distanceKm ? ` · ${fmtDistance(a.distanceKm, units)}` : ""}
                    </div>
                  </div>
                  <div className="text-right font-display font-semibold tabular-nums">
                    {fmtNum(a.caloriesBurned)} <span className="text-xs font-normal text-ink-3">kcal</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-3 border-t border-line pt-3 text-sm text-ink-2">
          Total: <b className="text-ink">{fmtDuration(today.activeMin)}</b> · <b className="text-ink">{fmtNum(today.caloriesOut)}</b> kcal burned
          (estimated)
        </div>
      </section>

      <Link
        to="/scan"
        className="card flex items-center gap-4 border-green/30 transition hover:border-green"
        style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--green) 10%, var(--card)), var(--card))" }}
      >
        <span className="grid size-12 place-items-center rounded-2xl bg-green text-on-green">
          <ScanLine className="size-6" />
        </span>
        <span className="flex-1">
          <span className="block font-display font-semibold">Scan a meal</span>
          <span className="text-sm text-ink-2">Photograph your food and let AI estimate the nutrition.</span>
        </span>
      </Link>
    </div>
  );
}
