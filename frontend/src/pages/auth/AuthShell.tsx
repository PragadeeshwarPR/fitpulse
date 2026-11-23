import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../../components/ui";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <div
        className="pointer-events-none absolute -top-40 left-1/2 size-[520px] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--green), transparent 65%)" }}
        aria-hidden
      />
      <div className="animate-rise relative w-full max-w-md">
        <Link to="/welcome" className="mb-8 flex justify-center">
          <Logo />
        </Link>
        <div className="card p-6 sm:p-8">
          <h1 className="heading">{title}</h1>
          {subtitle && <p className="mt-1 mb-6 text-sm text-ink-2">{subtitle}</p>}
          {children}
        </div>
        {footer && <div className="mt-5 text-center text-sm text-ink-2">{footer}</div>}
      </div>
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
      {message}
    </div>
  );
}
