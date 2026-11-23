import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Bell, Download, KeyRound, Moon, Palette, Sun, Target, Trash2, User as UserIcon } from "lucide-react";
import { api, apiUrl } from "../services/api";
import { useProfile } from "../hooks/useData";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { Field, Modal, PageHeader, PageLoader, Select, Spinner } from "../components/ui";
import { ACTIVITY_LEVELS, DIETS, GOALS } from "./Onboarding";
import { cmToDisplay, displayToCm, displayToKg, kgToDisplay, lengthUnit, weightUnit } from "../utils/format";
import type { UnitSystem } from "../utils/types";

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-4">
      <h2 className="flex items-center gap-2 font-display font-semibold">
        <span className="text-green">{icon}</span> {title}
      </h2>
      {children}
    </section>
  );
}

function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {desc && <span className="text-xs text-ink-3">{desc}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx("relative h-6 w-11 shrink-0 rounded-full transition", checked ? "bg-green" : "bg-card-2 ring-1 ring-line")}
      >
        <span className={clsx("absolute top-0.5 size-5 rounded-full bg-white transition", checked ? "left-[22px]" : "left-0.5")} />
      </button>
    </label>
  );
}

function ProfileSection() {
  const { data } = useProfile();
  const { user, refresh } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const p = data?.profile;
  const g = data?.goals;
  const [units, setUnits] = useState<UnitSystem>(p?.unitSystem ?? "metric");
  const [f, setF] = useState(() => ({
    fullName: user?.fullName ?? "",
    dateOfBirth: p?.dateOfBirth.slice(0, 10) ?? "",
    sex: p?.sex ?? "male",
    height: p ? String(Math.round(cmToDisplay(p.heightCm, p.unitSystem) * 10) / 10) : "",
    weight: p ? String(Math.round(kgToDisplay(p.weightKg, p.unitSystem) * 10) / 10) : "",
    target: g && p ? String(Math.round(kgToDisplay(g.targetWeightKg, p.unitSystem) * 10) / 10) : "",
    activityLevel: p?.activityLevel ?? "moderate",
    goal: g?.goal ?? "general_fitness",
    dietPreference: p?.dietPreference ?? "none",
    workoutsPerWeek: String(p?.workoutsPerWeek ?? 3),
    aiPersonalization: p?.aiPersonalization ?? true,
    dailyCalorieTarget: g ? String(g.dailyCalorieTarget) : "",
    waterTargetMl: String(g?.waterTargetMl ?? 2500),
    stepTarget: String(g?.stepTarget ?? 10000),
    sleepTargetH: String((g?.sleepTargetMin ?? 480) / 60),
  }));
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  function switchUnits(u: UnitSystem) {
    if (u === units) return;
    const cw = (v: string) => (v ? String(Math.round(kgToDisplay(displayToKg(Number(v), units), u) * 10) / 10) : v);
    const ch = (v: string) => (v ? String(Math.round(cmToDisplay(displayToCm(Number(v), units), u) * 10) / 10) : v);
    setF({ ...f, weight: cw(f.weight), target: cw(f.target), height: ch(f.height) });
    setUnits(u);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const weightKg = Math.round(displayToKg(Number(f.weight), units) * 10) / 10;
      const payload: Record<string, unknown> = {
        fullName: f.fullName,
        dateOfBirth: f.dateOfBirth,
        sex: f.sex,
        heightCm: Math.round(displayToCm(Number(f.height), units) * 10) / 10,
        weightKg,
        targetWeightKg: Math.round(displayToKg(Number(f.target), units) * 10) / 10,
        activityLevel: f.activityLevel,
        goal: f.goal,
        unitSystem: units,
        dietPreference: f.dietPreference,
        workoutsPerWeek: Number(f.workoutsPerWeek),
        aiPersonalization: f.aiPersonalization,
        waterTargetMl: Number(f.waterTargetMl),
        stepTarget: Number(f.stepTarget),
        sleepTargetMin: Math.round(Number(f.sleepTargetH) * 60),
      };
      // Only send a manual calorie target if the user changed it.
      if (g && Number(f.dailyCalorieTarget) !== g.dailyCalorieTarget) payload.dailyCalorieTarget = Number(f.dailyCalorieTarget);
      const r = await api<{ goals: { dailyCalorieTarget: number } }>("/profile", { method: "PATCH", json: payload });
      setF((x) => ({ ...x, dailyCalorieTarget: String(r.goals.dailyCalorieTarget) }));
      await qc.invalidateQueries();
      refresh();
      toast.show("Profile updated", "success");
    } catch (err) {
      toast.show((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <Section icon={<UserIcon className="size-4" />} title="Profile">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name" value={f.fullName} onChange={set("fullName")} />
          <Field label="Date of birth" type="date" value={f.dateOfBirth} onChange={set("dateOfBirth")} />
          <Select label="Biological sex (for BMR)" value={f.sex} onChange={set("sex")} options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }]} />
          <Select label="Units" value={units} onChange={(e) => switchUnits(e.target.value as UnitSystem)} options={[{ value: "metric", label: "Metric (kg, cm, km)" }, { value: "imperial", label: "Imperial (lb, in, mi)" }]} />
          <Field label={`Height (${lengthUnit(units)})`} type="number" step="0.1" value={f.height} onChange={set("height")} />
          <Field label={`Weight (${weightUnit(units)})`} type="number" step="0.1" value={f.weight} onChange={set("weight")} />
          <Select label="Activity level" value={f.activityLevel} onChange={set("activityLevel")} options={ACTIVITY_LEVELS} />
          <Field label="Workouts per week" type="number" min={0} max={14} value={f.workoutsPerWeek} onChange={set("workoutsPerWeek")} />
          <Select label="Diet preference" value={f.dietPreference} onChange={set("dietPreference")} options={DIETS.map((d) => ({ value: d, label: d === "none" ? "No preference" : d[0].toUpperCase() + d.slice(1) }))} />
        </div>
        <Toggle
          checked={f.aiPersonalization}
          onChange={(v) => setF({ ...f, aiPersonalization: v })}
          label="Personalise AI coaching"
          desc="Share your profile and recent progress (never your email) with the AI coach."
        />
      </Section>

      <Section icon={<Target className="size-4" />} title="Goals & targets">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Fitness goal" value={f.goal} onChange={set("goal")} options={GOALS} />
          <Field label={`Target weight (${weightUnit(units)})`} type="number" step="0.1" value={f.target} onChange={set("target")} />
          <Field label="Daily calories (kcal)" type="number" value={f.dailyCalorieTarget} onChange={set("dailyCalorieTarget")} hint={g ? `Calculated: TDEE ${g.tdee} · BMR ${g.bmr} · BMI ${g.bmi}` : undefined} />
          <Field label="Water target (ml)" type="number" step={50} value={f.waterTargetMl} onChange={set("waterTargetMl")} />
          <Field label="Step target" type="number" step={500} value={f.stepTarget} onChange={set("stepTarget")} />
          <Field label="Sleep target (hours)" type="number" step={0.5} min={4} max={12} value={f.sleepTargetH} onChange={set("sleepTargetH")} />
        </div>
        <p className="text-xs text-ink-3">Changing weight, height, age, activity or goal recalculates BMI, BMR, TDEE and macro targets.</p>
      </Section>
      <button className="btn-primary w-full sm:w-auto" disabled={busy}>
        {busy ? <Spinner className="size-4 text-on-green" /> : "Save profile"}
      </button>
    </form>
  );
}

type Prefs = {
  timezone: string; waterReminders: boolean; waterInterval: number; mealReminders: boolean; mealTimes: string[]; workoutReminder: boolean;
  workoutTime: string; sleepReminder: boolean; sleepTime: string; activityGoals: boolean; weeklyReport: boolean; quietStart: string; quietEnd: string;
};

const urlB64ToUint8 = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

function NotificationsSection() {
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["notifPrefs"],
    queryFn: () => api<{ prefs: Prefs; pushAvailable: boolean; vapidPublicKey: string | null; subscribed: boolean }>("/notifications/preferences"),
  });
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  useEffect(() => {
    if (q.data) setPrefs(q.data.prefs);
  }, [q.data]);
  const supported = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
  const permission = supported ? Notification.permission : "unsupported";

  async function enablePush() {
    try {
      if ((await Notification.requestPermission()) !== "granted") return toast.show("Notifications were blocked in your browser settings.", "warning");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(q.data!.vapidPublicKey!) });
      await api("/notifications/subscribe", { method: "POST", json: sub.toJSON() });
      qc.invalidateQueries({ queryKey: ["notifPrefs"] });
      toast.show("Push notifications enabled on this device", "success");
    } catch (e) {
      toast.show(`Couldn't enable push: ${(e as Error).message}`, "error");
    }
  }

  async function save(next: Prefs) {
    setPrefs(next);
    await api("/notifications/preferences", {
      method: "PUT",
      json: { ...next, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    }).catch((e) => toast.show((e as Error).message, "error"));
  }

  if (!prefs) return <Section icon={<Bell className="size-4" />} title="Notifications"><Spinner /></Section>;
  const upd = (p: Partial<Prefs>) => save({ ...prefs, ...p });

  return (
    <Section icon={<Bell className="size-4" />} title="Notifications">
      {!supported ? (
        <p className="rounded-xl bg-card-2 p-3 text-sm text-ink-2">
          This browser doesn't support push notifications. On iPhone, install FitPulse to your home screen first (iOS 16.4+). Your
          preferences are still saved.
        </p>
      ) : !q.data?.pushAvailable ? (
        <p className="rounded-xl bg-card-2 p-3 text-sm text-ink-2">Push notifications aren't configured on this server yet. Your preferences are saved for when they are.</p>
      ) : q.data.subscribed && permission === "granted" ? (
        <div className="flex items-center justify-between rounded-xl bg-green/10 p-3 text-sm">
          <span className="text-green">Push enabled on this account</span>
          <button className="text-xs font-semibold text-green underline" onClick={() => api("/notifications/test", { method: "POST" })}>
            Send test
          </button>
        </div>
      ) : (
        <button className="btn-primary" onClick={enablePush} disabled={permission === "denied"}>
          <Bell className="size-4" /> {permission === "denied" ? "Blocked in browser settings" : "Enable push notifications"}
        </button>
      )}
      <div className="space-y-4">
        <Toggle checked={prefs.waterReminders} onChange={(v) => upd({ waterReminders: v })} label="Water reminders" desc={`Every ${prefs.waterInterval / 60} h outside quiet hours`} />
        {prefs.waterReminders && (
          <Select label="Water reminder interval" value={String(prefs.waterInterval)} onChange={(e) => upd({ waterInterval: Number(e.target.value) })} options={[60, 90, 120, 180].map((m) => ({ value: String(m), label: `Every ${m / 60} h` }))} />
        )}
        <Toggle checked={prefs.mealReminders} onChange={(v) => upd({ mealReminders: v })} label="Meal reminders" desc={prefs.mealTimes.join(" · ")} />
        <div className="flex items-center justify-between gap-4">
          <Toggle checked={prefs.workoutReminder} onChange={(v) => upd({ workoutReminder: v })} label="Workout reminder" />
          <input type="time" className="input w-32" value={prefs.workoutTime} onChange={(e) => upd({ workoutTime: e.target.value })} aria-label="Workout reminder time" />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Toggle checked={prefs.sleepReminder} onChange={(v) => upd({ sleepReminder: v })} label="Bedtime reminder" />
          <input type="time" className="input w-32" value={prefs.sleepTime} onChange={(e) => upd({ sleepTime: e.target.value })} aria-label="Bedtime reminder time" />
        </div>
        <Toggle checked={prefs.activityGoals} onChange={(v) => upd({ activityGoals: v })} label="Daily activity goal nudge" desc="7 pm check-in on steps and activity" />
        <Toggle checked={prefs.weeklyReport} onChange={(v) => upd({ weeklyReport: v })} label="Weekly progress report" desc="Sunday morning" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quiet hours start" type="time" value={prefs.quietStart} onChange={(e) => upd({ quietStart: e.target.value })} />
          <Field label="Quiet hours end" type="time" value={prefs.quietEnd} onChange={(e) => upd({ quietEnd: e.target.value })} />
        </div>
      </div>
    </Section>
  );
}

function SecuritySection() {
  const toast = useToast();
  const { logout } = useAuth();
  const nav = useNavigate();
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [del, setDel] = useState({ open: false, password: "", confirm: "" });
  const [busy, setBusy] = useState(false);

  return (
    <Section icon={<KeyRound className="size-4" />} title="Account & privacy">
      <form
        className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api("/auth/change-password", { method: "POST", json: pw });
            setPw({ currentPassword: "", newPassword: "" });
            toast.show("Password changed. Other devices were signed out.", "success");
          } catch (err) {
            toast.show((err as Error).message, "error");
          }
        }}
      >
        <Field label="Current password" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
        <Field label="New password" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
        <button className="btn-ghost" disabled={!pw.currentPassword || !pw.newPassword}>
          Change
        </button>
      </form>
      <div className="flex flex-wrap gap-3 border-t border-line pt-4">
        <a className="btn-ghost" href={apiUrl("/account/export")} download>
          <Download className="size-4" /> Export my data (JSON)
        </a>
        <button className="btn-ghost text-danger" onClick={() => setDel({ ...del, open: true })}>
          <Trash2 className="size-4" /> Delete account
        </button>
      </div>
      <Modal open={del.open} onClose={() => setDel({ open: false, password: "", confirm: "" })} title="Delete account">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api("/account", { method: "DELETE", json: { password: del.password, confirm: del.confirm } });
              await logout();
              nav("/welcome", { replace: true });
            } catch (err) {
              toast.show((err as Error).message, "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="text-sm text-ink-2">
            This permanently deletes your account, all logs, photos and AI conversations. This cannot be undone. Consider exporting your
            data first.
          </p>
          <Field label="Password" type="password" value={del.password} onChange={(e) => setDel({ ...del, password: e.target.value })} />
          <Field label='Type "DELETE" to confirm' value={del.confirm} onChange={(e) => setDel({ ...del, confirm: e.target.value })} />
          <button className="btn-danger w-full" disabled={busy || del.confirm !== "DELETE" || !del.password}>
            {busy ? <Spinner className="size-4 text-white" /> : "Permanently delete"}
          </button>
        </form>
      </Modal>
    </Section>
  );
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { isLoading } = useProfile();
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Settings" />
      <Section icon={<Palette className="size-4" />} title="Appearance">
        <div className="grid grid-cols-2 gap-3">
          {(["dark", "light"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              aria-pressed={theme === t}
              className={clsx("flex items-center justify-center gap-2 rounded-2xl border p-4 font-medium capitalize", theme === t ? "border-green bg-green/10 text-green" : "border-line bg-card-2")}
            >
              {t === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />} {t}
            </button>
          ))}
        </div>
      </Section>
      {isLoading ? <PageLoader /> : <ProfileSection />}
      <NotificationsSection />
      <SecuritySection />
    </div>
  );
}
