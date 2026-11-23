import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import clsx from "clsx";
import { api, ApiError } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Field, Logo, Spinner } from "../components/ui";
import { displayToKg, KG_PER_LB, weightUnit } from "../utils/format";
import type { ActivityLevel, Goal, UnitSystem } from "../utils/types";

type Form = {
  dateOfBirth: string;
  sex: "male" | "female";
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  targetWeightKg: number;
  unitSystem: UnitSystem;
  dietPreference: string;
  workoutsPerWeek: number;
  aiPersonalization: boolean;
};

type Targets = { bmi: number; bmr: number; tdee: number; dailyCalorieTarget: number; proteinTargetG: number; carbsTargetG: number; fatTargetG: number; waterTargetMl: number };

export const GOALS: { value: Goal; label: string; desc: string }[] = [
  { value: "lose_weight", label: "Lose weight", desc: "~0.5 kg/week calorie deficit" },
  { value: "maintain_weight", label: "Maintain weight", desc: "Eat at maintenance" },
  { value: "gain_weight", label: "Gain weight", desc: "Moderate calorie surplus" },
  { value: "build_muscle", label: "Build muscle", desc: "Lean surplus, high protein" },
  { value: "improve_endurance", label: "Improve endurance", desc: "Fuel cardio performance" },
  { value: "general_fitness", label: "General fitness", desc: "Feel and move better" },
];

export const ACTIVITY_LEVELS: { value: ActivityLevel; label: string; desc: string }[] = [
  { value: "sedentary", label: "Sedentary", desc: "Desk job, little exercise" },
  { value: "light", label: "Lightly active", desc: "Exercise 1–3 days/week" },
  { value: "moderate", label: "Moderately active", desc: "Exercise 3–5 days/week" },
  { value: "active", label: "Very active", desc: "Hard exercise 6–7 days/week" },
  { value: "very_active", label: "Extremely active", desc: "Physical job + training" },
];

export const DIETS = ["none", "vegetarian", "vegan", "eggetarian", "pescatarian", "keto", "low-carb", "high-protein", "gluten-free"];

const STEPS = ["About you", "Body", "Activity", "Goal", "Preferences", "Your plan"];

function Choice({ active, onClick, title, desc }: { active: boolean; onClick: () => void; title: string; desc?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "flex w-full items-center justify-between rounded-2xl border p-4 text-left transition",
        active ? "border-green bg-green/10" : "border-line bg-card-2 hover:border-green/40",
      )}
    >
      <span>
        <span className="block font-medium">{title}</span>
        {desc && <span className="text-sm text-ink-2">{desc}</span>}
      </span>
      {active && <Check className="size-5 text-green" />}
    </button>
  );
}

export default function Onboarding() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user, setSession } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>({
    dateOfBirth: "",
    sex: "male",
    heightCm: 170,
    weightKg: 70,
    activityLevel: "moderate",
    goal: "general_fitness",
    targetWeightKg: 70,
    unitSystem: "metric",
    dietPreference: "none",
    workoutsPerWeek: 3,
    aiPersonalization: true,
  });
  // Imperial inputs kept as raw display values.
  const [ft, setFt] = useState(5);
  const [inch, setInch] = useState(7);
  const [weightInput, setWeightInput] = useState("70");
  const [targetInput, setTargetInput] = useState("70");
  const [targets, setTargets] = useState<Targets | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const imperial = form.unitSystem === "imperial";
  const update = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));

  // Convert display inputs to canonical metric values.
  useEffect(() => {
    const w = Number(weightInput);
    const t = Number(targetInput);
    update({
      weightKg: w ? Math.round(displayToKg(w, form.unitSystem) * 10) / 10 : 0,
      targetWeightKg: t ? Math.round(displayToKg(t, form.unitSystem) * 10) / 10 : 0,
      ...(imperial ? { heightCm: Math.round((ft * 12 + inch) * 2.54) } : {}),
    });
  }, [weightInput, targetInput, ft, inch, form.unitSystem, imperial]);

  const age = useMemo(() => (form.dateOfBirth ? Math.floor((Date.now() - Date.parse(form.dateOfBirth)) / (365.25 * 86_400_000)) : null), [form.dateOfBirth]);

  const stepValid = [
    age !== null && age >= 13 && age <= 110,
    form.heightCm >= 100 && form.heightCm <= 250 && form.weightKg >= 25 && form.weightKg <= 350,
    true,
    form.targetWeightKg >= 25 && form.targetWeightKg <= 350,
    true,
    true,
  ][step];

  useEffect(() => {
    if (step !== 5) return;
    setTargets(null);
    api<Targets>("/profile/preview-targets", { method: "POST", json: form })
      .then(setTargets)
      .catch((e) => setError((e as Error).message));
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      await api("/profile/onboarding", { method: "POST", json: form });
      await qc.invalidateQueries();
      if (user) setSession(user, true);
      nav("/", { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const switchUnits = (u: UnitSystem) => {
    if (u === form.unitSystem) return;
    const conv = (v: string) => {
      const n = Number(v);
      if (!n) return v;
      return String(Math.round((u === "imperial" ? n / KG_PER_LB : n * KG_PER_LB) * 10) / 10);
    };
    setWeightInput(conv(weightInput));
    setTargetInput(conv(targetInput));
    if (u === "imperial") {
      const total = form.heightCm / 2.54;
      setFt(Math.floor(total / 12));
      setInch(Math.round(total % 12));
    }
    update({ unitSystem: u });
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <Logo />
        <span className="text-sm text-ink-3">
          Step {step + 1} of {STEPS.length}
        </span>
      </div>
      <div className="mb-8 flex gap-1.5" aria-hidden>
        {STEPS.map((s, i) => (
          <div key={s} className={clsx("h-1.5 flex-1 rounded-full transition", i <= step ? "bg-green" : "bg-card-2")} />
        ))}
      </div>

      <div key={step} className="animate-rise flex-1">
        <h1 className="heading mb-1">{STEPS[step]}</h1>
        {step === 0 && (
          <div className="mt-5 space-y-5">
            <p className="text-sm text-ink-2">Hi {user?.fullName.split(" ")[0]}! A few details let us calculate your personal targets.</p>
            <Field
              label="Date of birth"
              type="date"
              value={form.dateOfBirth}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => update({ dateOfBirth: e.target.value })}
              hint={age !== null ? `${age} years old` : undefined}
              error={age !== null && (age < 13 || age > 110) ? "FitPulse is for ages 13 and up." : undefined}
            />
            <div>
              <span className="label">Biological sex</span>
              <p className="mb-2 text-xs text-ink-3">Used only for the Mifflin-St Jeor metabolic rate formula.</p>
              <div className="grid grid-cols-2 gap-3">
                <Choice active={form.sex === "male"} onClick={() => update({ sex: "male" })} title="Male" />
                <Choice active={form.sex === "female"} onClick={() => update({ sex: "female" })} title="Female" />
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="mt-5 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <Choice active={!imperial} onClick={() => switchUnits("metric")} title="Metric" desc="kg · cm · km" />
              <Choice active={imperial} onClick={() => switchUnits("imperial")} title="Imperial" desc="lb · ft/in · mi" />
            </div>
            {imperial ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Height (ft)" type="number" inputMode="numeric" min={3} max={8} value={ft} onChange={(e) => setFt(Number(e.target.value))} />
                <Field label="Height (in)" type="number" inputMode="numeric" min={0} max={11} value={inch} onChange={(e) => setInch(Number(e.target.value))} />
              </div>
            ) : (
              <Field
                label="Height (cm)"
                type="number"
                inputMode="decimal"
                min={100}
                max={250}
                value={form.heightCm || ""}
                onChange={(e) => update({ heightCm: Number(e.target.value) })}
              />
            )}
            <Field
              label={`Current weight (${weightUnit(form.unitSystem)})`}
              type="number"
              inputMode="decimal"
              step="0.1"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
            />
          </div>
        )}

        {step === 2 && (
          <div className="mt-5 space-y-3">
            {ACTIVITY_LEVELS.map((a) => (
              <Choice key={a.value} active={form.activityLevel === a.value} onClick={() => update({ activityLevel: a.value })} title={a.label} desc={a.desc} />
            ))}
            <div className="pt-3">
              <span className="label">Workouts per week: {form.workoutsPerWeek}</span>
              <input
                type="range"
                min={0}
                max={14}
                value={form.workoutsPerWeek}
                onChange={(e) => update({ workoutsPerWeek: Number(e.target.value) })}
                className="w-full accent-[var(--green)]"
                aria-label="Workouts per week"
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mt-5 space-y-3">
            {GOALS.map((g) => (
              <Choice key={g.value} active={form.goal === g.value} onClick={() => update({ goal: g.value })} title={g.label} desc={g.desc} />
            ))}
            <div className="pt-3">
              <Field
                label={`Target weight (${weightUnit(form.unitSystem)})`}
                type="number"
                inputMode="decimal"
                step="0.1"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="mt-5 space-y-5">
            <div>
              <span className="label">Diet preference</span>
              <div className="flex flex-wrap gap-2">
                {DIETS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => update({ dietPreference: d })}
                    className={clsx("chip capitalize", form.dietPreference === d && "chip-active")}
                  >
                    {d === "none" ? "No preference" : d}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-card-2 p-4">
              <input
                type="checkbox"
                checked={form.aiPersonalization}
                onChange={(e) => update({ aiPersonalization: e.target.checked })}
                className="mt-1 size-4 accent-[var(--green)]"
              />
              <span>
                <span className="block font-medium">Personalise AI coaching</span>
                <span className="text-sm text-ink-2">
                  Let the AI coach use your profile and recent progress (not your email) to tailor answers. You can change this anytime.
                </span>
              </span>
            </label>
          </div>
        )}

        {step === 5 && (
          <div className="mt-5">
            {!targets ? (
              <div className="grid h-48 place-items-center">
                <Spinner className="size-7" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="card border-green/40 text-center" style={{ boxShadow: "var(--glow)" }}>
                  <div className="text-sm text-ink-2">Daily calorie target</div>
                  <div className="glow-text font-display text-5xl font-bold text-green">{targets.dailyCalorieTarget.toLocaleString()}</div>
                  <div className="text-sm text-ink-3">kcal / day</div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    ["BMI", targets.bmi.toFixed(1)],
                    ["BMR", `${targets.bmr}`],
                    ["TDEE", `${targets.tdee}`],
                  ].map(([l, v]) => (
                    <div key={l} className="card p-4 text-center">
                      <div className="font-display text-xl font-bold">{v}</div>
                      <div className="text-xs text-ink-3">{l}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    ["Protein", targets.proteinTargetG],
                    ["Carbs", targets.carbsTargetG],
                    ["Fat", targets.fatTargetG],
                  ].map(([l, v]) => (
                    <div key={l} className="rounded-2xl bg-card-2 p-3 text-center">
                      <div className="font-display text-lg font-bold">{v}g</div>
                      <div className="text-xs text-ink-3">{l}</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs leading-relaxed text-ink-3">
                  BMR uses the Mifflin-St Jeor equation and TDEE applies your activity multiplier. These are estimates, not medical advice.
                  You can adjust targets later in Settings.
                </p>
              </div>
            )}
          </div>
        )}
        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
      </div>

      <div className="mt-8 flex gap-3">
        {step > 0 && (
          <button className="btn-ghost" onClick={() => setStep(step - 1)} aria-label="Back">
            <ArrowLeft className="size-4" />
          </button>
        )}
        {step < 5 ? (
          <button className="btn-primary flex-1" disabled={!stepValid} onClick={() => setStep(step + 1)}>
            Continue <ArrowRight className="size-4" />
          </button>
        ) : (
          <button className="btn-primary flex-1" disabled={busy || !targets} onClick={finish}>
            {busy ? <Spinner className="size-4 text-on-green" /> : "Start my journey"}
          </button>
        )}
      </div>
    </div>
  );
}
