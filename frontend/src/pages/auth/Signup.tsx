import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, X } from "lucide-react";
import clsx from "clsx";
import { api, fieldError, isNetworkError } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { Field, Spinner } from "../../components/ui";
import { AuthShell, FormError } from "./AuthShell";
import type { User } from "../../utils/types";

const RULES = [
  { test: (p: string) => p.length >= 8, label: "8+ characters" },
  { test: (p: string) => /[A-Z]/.test(p) && /[a-z]/.test(p), label: "Upper & lowercase" },
  { test: (p: string) => /\d/.test(p), label: "A number" },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), label: "A symbol" },
];

export default function Signup() {
  const { setSession } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const passed = useMemo(() => RULES.map((r) => r.test(form.password)), [form.password]);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const mismatch = form.confirmPassword.length > 0 && form.password !== form.confirmPassword;
  const valid = form.fullName.trim().length >= 2 && emailValid && passed.every(Boolean) && !mismatch && form.confirmPassword;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ user: User; onboarded: boolean }>("/auth/signup", { method: "POST", json: form });
      setSession(r.user, false);
      nav("/onboarding", { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const general = error
    ? isNetworkError(error)
      ? "You're offline. Creating an account needs an internet connection."
      : fieldError(error, "email") || fieldError(error, "password")
        ? null
        : (error as Error).message
    : null;

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start tracking smarter in under two minutes."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-green">
            Log in
          </Link>
        </>
      }
    >
      <FormError message={general} />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Full name" autoComplete="name" required value={form.fullName} onChange={set("fullName")} error={fieldError(error, "fullName")} />
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={set("email")}
          error={fieldError(error, "email") ?? (form.email && !emailValid ? "Enter a valid email address" : undefined) ?? (error && (error as { status?: number }).status === 409 ? (error as Error).message : undefined)}
        />
        <Field label="Password" type="password" autoComplete="new-password" required value={form.password} onChange={set("password")} />
        <ul className="grid grid-cols-2 gap-1.5 text-xs" aria-label="Password requirements">
          {RULES.map((r, i) => (
            <li key={r.label} className={clsx("flex items-center gap-1.5", passed[i] ? "text-green" : "text-ink-3")}>
              {passed[i] ? <Check className="size-3.5" /> : <X className="size-3.5" />} {r.label}
            </li>
          ))}
        </ul>
        <Field
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          required
          value={form.confirmPassword}
          onChange={set("confirmPassword")}
          error={mismatch ? "Passwords do not match" : undefined}
        />
        <button className="btn-primary w-full" disabled={busy || !valid}>
          {busy ? <Spinner className="size-4 text-on-green" /> : "Create account"}
        </button>
        <p className="text-center text-xs text-ink-3">We'll send a link to verify your email.</p>
      </form>
    </AuthShell>
  );
}
