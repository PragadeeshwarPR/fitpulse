import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle } from "lucide-react";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { Spinner } from "../../components/ui";
import { AuthShell } from "./AuthShell";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const { user, refresh } = useAuth();
  const [state, setState] = useState<"pending" | "ok" | "error">("pending");
  const [msg, setMsg] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    api("/auth/verify-email", { method: "POST", json: { token: params.get("token") ?? "" } })
      .then(() => {
        setState("ok");
        refresh();
      })
      .catch((e) => {
        setState("error");
        setMsg((e as Error).message);
      });
  }, [params, refresh]);

  return (
    <AuthShell title="Email verification">
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        {state === "pending" && <Spinner className="size-8" />}
        {state === "ok" && (
          <>
            <CheckCircle2 className="size-10 text-green" />
            <p className="text-sm text-ink-2">Your email is verified. You're all set!</p>
          </>
        )}
        {state === "error" && (
          <>
            <XCircle className="size-10 text-danger" />
            <p className="text-sm text-ink-2">{msg}</p>
            {user && <p className="text-xs text-ink-3">You can request a new link from the banner inside the app.</p>}
          </>
        )}
        {state !== "pending" && (
          <Link to={user ? "/" : "/login"} className="btn-primary mt-2">
            Continue
          </Link>
        )}
      </div>
    </AuthShell>
  );
}
