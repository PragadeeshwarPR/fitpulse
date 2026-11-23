/**
 * Shared chart pieces. Conventions: one y-axis per chart, recessive grid, thin
 * marks with rounded data-ends, hover tooltip on every chart, and a legend
 * whenever there are two or more series. Series colours come from validated
 * CSS tokens (--series-1..3) so they adapt to light/dark themes.
 */
import type { ReactNode } from "react";

export const AXIS = { stroke: "var(--text-3)", fontSize: 11, tickLine: false, axisLine: false } as const;
export const GRID = { stroke: "var(--grid)", strokeDasharray: "0", vertical: false } as const;

type TooltipPayload = { name?: string; value?: number | string; color?: string; dataKey?: string | number; payload?: Record<string, unknown> };

export function ChartTooltip({
  active,
  payload,
  label,
  format = (v) => String(v),
  labelFormat = (l) => String(l),
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string | number;
  format?: (v: number, key?: string) => string;
  labelFormat?: (l: string | number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-card-2 px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 font-medium text-ink">{labelFormat(label ?? "")}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-2 text-ink-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-semibold text-ink tabular-nums">{format(Number(p.value), String(p.dataKey))}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-ink-2">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          {i.dashed ? (
            <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: i.color }} />
          ) : (
            <span className="size-2.5 rounded-sm" style={{ background: i.color }} />
          )}
          {i.label}
        </span>
      ))}
    </div>
  );
}

export function ChartCard({ title, subtitle, legend, children, className }: { title: string; subtitle?: ReactNode; legend?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className ?? ""}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-ink-3">{subtitle}</p>}
        </div>
        {legend}
      </div>
      {children}
    </section>
  );
}

/** Compact axis ticks (8000 -> 8k) so labels never clip. */
export const compactTick = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round((v / 1000) * 10) / 10}k` : String(v));

/** Y-domain that always includes a goal line, so the reference is never off-chart. */
export const domainWithGoal = (goal?: number) => [0, (max: number) => Math.max(max, (goal ?? 0) * 1.1)] as [number, (m: number) => number];
