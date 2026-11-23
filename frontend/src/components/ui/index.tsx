import { useEffect, useId, useRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import clsx from "clsx";
import { prettyDate, shiftDate, todayKey } from "../../utils/format";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-2 font-display text-lg font-bold tracking-tight", className)}>
      <svg viewBox="0 0 512 512" className="size-8" aria-hidden>
        <rect width="512" height="512" rx="112" fill="var(--card)" />
        <path d="M88 272h86l38-92 62 178 44-118 22 32h84" fill="none" stroke="var(--green)" strokeWidth="38" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Fit<span className="text-green">Pulse</span>
    </span>
  );
}

export const Spinner = ({ className }: { className?: string }) => (
  <Loader2 className={clsx("animate-spin text-green", className ?? "size-5")} aria-label="Loading" />
);

export function PageLoader() {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <Spinner className="size-7" />
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="heading">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Field({
  label,
  error,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: ReactNode }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input id={id} className={clsx("input", error && "border-danger")} aria-invalid={Boolean(error)} {...props} />
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : hint ? <p className="mt-1 text-xs text-ink-3">{hint}</p> : null}
    </div>
  );
}

export function Select({
  label,
  options,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: { value: string; label: string }[] }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <select id={id} className="input" {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("input,select,textarea,button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          "animate-rise pb-safe max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-line bg-card p-5 sm:rounded-3xl",
          wide ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-2 hover:bg-card-2 hover:text-ink" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function DateNav({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const isToday = value >= todayKey();
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-line bg-card p-1">
      <button className="rounded-lg p-1.5 hover:bg-card-2" onClick={() => onChange(shiftDate(value, -1))} aria-label="Previous day">
        <ChevronLeft className="size-4" />
      </button>
      <label className="relative min-w-28 cursor-pointer px-2 text-center text-sm font-medium">
        {prettyDate(value)}
        <input
          type="date"
          value={value}
          max={todayKey()}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Pick date"
        />
      </label>
      <button
        className="rounded-lg p-1.5 hover:bg-card-2 disabled:opacity-30"
        disabled={isToday}
        onClick={() => onChange(shiftDate(value, 1))}
        aria-label="Next day"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

/** Circular progress (used for calories, water, steps). */
export function ProgressRing({
  value,
  max,
  size = 180,
  stroke = 14,
  children,
  color = "var(--green)",
  label,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  color?: string;
  label: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const over = max > 0 && value > max;
  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${Math.round(pct * 100)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--card-2)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={over ? "var(--warning)" : color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.2,0.8,0.2,1)", filter: "drop-shadow(0 0 6px color-mix(in srgb, var(--green) 45%, transparent))" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function ProgressBar({ label, value, max, unit = "g", color = "var(--green)" }: { label: string; value: number; max: number; unit?: string; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-ink-2 tabular-nums">
          <span className="text-ink">{Math.round(value)}</span> / {Math.round(max)} {unit}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-card-2"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(value)}
        aria-valuemax={Math.round(max)}
      >
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export function Stat({ icon, label, value, sub }: { icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="card flex flex-col gap-2 p-4">
      <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-ink-2 uppercase">
        <span className="grid size-7 place-items-center rounded-lg bg-green/10 text-green">{icon}</span>
        {label}
      </div>
      <div className="font-display text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-ink-3">{sub}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-green/10 text-green">{icon}</div>
      <p className="font-medium">{title}</p>
      {children && <div className="text-sm text-ink-2">{children}</div>}
    </div>
  );
}

export function PendingBadge() {
  return <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-warn uppercase">Pending sync</span>;
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-card p-1" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition",
            value === o.value ? "bg-green text-on-green" : "text-ink-2 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
