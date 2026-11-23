import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, Trophy, X, XCircle } from "lucide-react";
import clsx from "clsx";

type Kind = "success" | "error" | "info" | "warning" | "achievement";
type Toast = { id: number; kind: Kind; message: string };
type Ctx = { show: (m: string, k?: Kind) => void; achievement: (title: string) => void };

const ToastCtx = createContext<Ctx>({ show: () => undefined, achievement: () => undefined });
export const useToast = () => useContext(ToastCtx);

const ICONS = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle, achievement: Trophy };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));
  const show = useCallback((message: string, kind: Kind = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, kind, message }]);
    setTimeout(() => dismiss(id), kind === "achievement" ? 6000 : 4000);
  }, []);
  const value = useMemo(() => ({ show, achievement: (title: string) => show(`Achievement unlocked: ${title}`, "achievement") }), [show]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICONS[t.kind];
          return (
            <div
              key={t.id}
              className={clsx(
                "animate-rise pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border bg-card-2 px-4 py-3 text-sm shadow-2xl",
                t.kind === "error" ? "border-danger/50" : t.kind === "warning" ? "border-warn/50" : "border-green/40",
              )}
            >
              <Icon
                className={clsx("mt-0.5 size-4 shrink-0", t.kind === "error" ? "text-danger" : t.kind === "warning" ? "text-warn" : "text-green")}
                aria-hidden
              />
              <span className="flex-1">{t.message}</span>
              <button onClick={() => dismiss(t.id)} className="text-ink-3 hover:text-ink" aria-label="Dismiss">
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
