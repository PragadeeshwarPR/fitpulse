import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3, Bot, CloudOff, Droplet, Dumbbell, Home, LayoutGrid, LogOut, Moon, RefreshCw, Ruler, ScanLine, Settings, Trophy, Utensils,
} from "lucide-react";
import clsx from "clsx";
import { useEffect } from "react";
import { Logo } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useSync } from "../hooks/useSync";
import { InstallButton } from "../components/InstallButton";
import { VerifyBanner } from "../components/VerifyBanner";

const NAV = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/food", label: "Food diary", icon: Utensils },
  { to: "/scan", label: "AI scanner", icon: ScanLine },
  { to: "/activity", label: "Activity", icon: Dumbbell },
  { to: "/water", label: "Water", icon: Droplet },
  { to: "/sleep", label: "Sleep", icon: Moon },
  { to: "/body", label: "Body", icon: Ruler },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/assistant", label: "AI coach", icon: Bot },
  { to: "/achievements", label: "Achievements", icon: Trophy },
  { to: "/settings", label: "Settings", icon: Settings },
];

const MOBILE = [
  { to: "/", label: "Home", icon: Home },
  { to: "/food", label: "Food", icon: Utensils },
  { to: "/scan", label: "Scan", icon: ScanLine, primary: true },
  { to: "/activity", label: "Activity", icon: Dumbbell },
  { to: "/more", label: "More", icon: LayoutGrid },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { online, pending, syncing, sync } = useSync(Boolean(user));
  const loc = useLocation();
  useEffect(() => {
    // Block body: scrollTo returns a Promise in newer browsers, which React would treat as a cleanup.
    window.scrollTo(0, 0);
  }, [loc.pathname]);

  return (
    <div className="min-h-dvh lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-bg-2 p-4 lg:flex">
        <Logo className="mb-6 px-2" />
        <nav className="flex flex-1 flex-col gap-0.5" aria-label="Main">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  isActive ? "bg-green/10 text-green" : "text-ink-2 hover:bg-card hover:text-ink",
                )
              }
            >
              <Icon className="size-[18px]" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
        <InstallButton className="mb-2" />
        <div className="flex items-center gap-3 rounded-xl border border-line bg-card p-3">
          <div className="grid size-9 place-items-center rounded-full bg-green/15 font-semibold text-green">{user?.fullName[0]?.toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user?.fullName}</div>
            <div className="truncate text-xs text-ink-3">{user?.email}</div>
          </div>
          <button onClick={logout} className="rounded-lg p-1.5 text-ink-2 hover:text-danger" aria-label="Log out">
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-bg/85 px-4 py-3 backdrop-blur lg:hidden">
          <Logo />
          <InstallButton compact />
        </header>

        {(!online || pending > 0) && (
          <div
            className={clsx(
              "flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium",
              online ? "bg-green/10 text-green" : "bg-warn/15 text-warn",
            )}
            role="status"
          >
            {online ? <RefreshCw className={clsx("size-3.5", syncing && "animate-spin")} /> : <CloudOff className="size-3.5" />}
            {online
              ? `${pending} offline change${pending === 1 ? "" : "s"} waiting to sync`
              : `You're offline. Meals, workouts, water and sleep are saved on this device${pending ? ` (${pending} pending)` : ""}.`}
            {online && pending > 0 && !syncing && (
              <button onClick={sync} className="underline underline-offset-2">
                Sync now
              </button>
            )}
          </div>
        )}
        <VerifyBanner />

        <main className="mx-auto max-w-6xl px-4 pt-5 pb-28 lg:px-8 lg:pt-8 lg:pb-12">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg-2/95 backdrop-blur lg:hidden" aria-label="Main">
        <div className="mx-auto grid max-w-md grid-cols-5 px-2">
          {MOBILE.map(({ to, label, icon: Icon, primary }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                clsx("flex flex-col items-center gap-1 py-2 text-[11px] font-medium", isActive ? "text-green" : "text-ink-3")
              }
            >
              {primary ? (
                <span className="-mt-6 grid size-14 place-items-center rounded-2xl bg-green text-on-green" style={{ boxShadow: "var(--glow)" }}>
                  <Icon className="size-6" aria-hidden />
                </span>
              ) : (
                <Icon className="size-5" aria-hidden />
              )}
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
