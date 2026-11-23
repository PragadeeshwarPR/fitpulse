import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, isNetworkError } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { Field, Spinner } from "../../components/ui";
import { AuthShell, FormError } from "./AuthShell";
import type { User } from "../../utils/types";

export default function Login() {
  const { setSession } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ user: User; onboarded: boolean }>("/auth/login", { method: "POST", json: { email, password } });
      setSession(r.user, r.onboarded);
      nav(r.onboarded ? ((loc.state as { from?: string })?.from ?? "/") : "/onboarding", { replace: true });
    } catch (err) {
      setError(isNetworkError(err) ? "You're offline. Signing in needs an internet connection." : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to continue your progress."
      footer={
        <>
          New to FitPulse?{" "}
          <Link to="/signup" className="font-semibold text-green">
            Create an account
          </Link>
        </>
      }
    >
      <FormError message={error} />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm text-ink-2 hover:text-green">
            Forgot password?
          </Link>
        </div>
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? <Spinner className="size-4 text-on-green" /> : "Log in"}
        </button>
      </form>
    </AuthShell>
  );
}
