import { useState } from "react";
import { MailWarning } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

export function VerifyBanner() {
  const { user } = useAuth();
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  if (!user || user.emailVerified) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 bg-card px-4 py-2 text-xs text-ink-2">
      <MailWarning className="size-3.5 text-warn" />
      Verify your email ({user.email}) to secure your account.
      <button
        disabled={state !== "idle"}
        className="font-semibold text-green disabled:opacity-60"
        onClick={async () => {
          setState("sending");
          await api("/auth/resend-verification", { method: "POST" }).catch(() => undefined);
          setState("sent");
        }}
      >
        {state === "sent" ? "Email sent ✓" : state === "sending" ? "Sending…" : "Resend link"}
      </button>
    </div>
  );
}
