import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { api, fieldError } from "../../services/api";
import { Field, Spinner } from "../../components/ui";
import { AuthShell, FormError } from "./AuthShell";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/auth/reset-password", { method: "POST", json: { token, password, confirmPassword } });
      setDone(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <AuthShell title="Invalid link" footer={<Link to="/forgot-password" className="font-semibold text-green">Request a new link</Link>}>
        <p className="text-sm text-ink-2">This reset link is missing its token.</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="You'll be signed out of other devices.">
      {done ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 className="size-10 text-green" />
          <p className="text-sm text-ink-2">Your password has been updated.</p>
          <Link to="/login" className="btn-primary">
            Log in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <FormError message={error && !fieldError(error, "password") ? (error as Error).message : null} />
          <Field
            label="New password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldError(error, "password")}
            hint="8+ characters with upper & lowercase, a number and a symbol."
          />
          <Field
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirm(e.target.value)}
            error={confirmPassword && confirmPassword !== password ? "Passwords do not match" : undefined}
          />
          <button className="btn-primary w-full" disabled={busy || !password || password !== confirmPassword}>
            {busy ? <Spinner className="size-4 text-on-green" /> : "Update password"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
