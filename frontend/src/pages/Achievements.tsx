import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Calendar, Droplet, Droplets, Dumbbell, Flame, Footprints, Lock, Moon, Scale, ScanLine, Trophy, Utensils, Zap } from "lucide-react";
import { api } from "../services/api";
import { PageHeader, PageLoader } from "../components/ui";
import type { Achievement } from "../utils/types";

const ICONS: Record<string, typeof Trophy> = {
  footprints: Footprints, trophy: Trophy, flame: Flame, zap: Zap, dumbbell: Dumbbell, utensils: Utensils, scan: ScanLine,
  calendar: Calendar, droplet: Droplet, droplets: Droplets, moon: Moon, scale: Scale,
};

export default function Achievements() {
  const { data, isLoading } = useQuery({ queryKey: ["achievements"], queryFn: () => api<{ items: Achievement[] }>("/achievements") });
  if (isLoading) return <PageLoader />;
  const items = data?.items ?? [];
  const unlocked = items.filter((a) => a.unlocked).sort((a, b) => Date.parse(b.unlockedAt!) - Date.parse(a.unlockedAt!));

  return (
    <div>
      <PageHeader title="Achievements" subtitle={`${unlocked.length} of ${items.length} badges earned`} />
      <div className="mb-6 h-2 overflow-hidden rounded-full bg-card-2">
        <div className="h-full rounded-full bg-green transition-all" style={{ width: `${(unlocked.length / (items.length || 1)) * 100}%`, boxShadow: "var(--glow)" }} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((a) => {
          const Icon = ICONS[a.icon] ?? Trophy;
          return (
            <div key={a.code} className={clsx("card flex flex-col items-center gap-2 p-5 text-center transition", a.unlocked ? "border-green/40" : "opacity-60")}>
              <div
                className={clsx("relative grid size-16 place-items-center rounded-2xl", a.unlocked ? "bg-green text-on-green" : "bg-card-2 text-ink-3")}
                style={a.unlocked ? { boxShadow: "var(--glow)" } : undefined}
              >
                <Icon className="size-7" />
                {!a.unlocked && <Lock className="absolute -right-1 -bottom-1 size-5 rounded-full bg-card p-0.5 text-ink-3" />}
              </div>
              <div className="font-display font-semibold">{a.title}</div>
              <div className="text-xs text-ink-2">{a.description}</div>
              {a.unlocked && <div className="text-[11px] text-green">Earned {new Date(a.unlockedAt!).toLocaleDateString()}</div>}
            </div>
          );
        })}
      </div>
      {unlocked.length > 0 && (
        <section className="card mt-6">
          <h2 className="mb-3 font-display font-semibold">History</h2>
          <ol className="space-y-2">
            {unlocked.map((a) => (
              <li key={a.code} className="flex justify-between text-sm">
                <span>
                  <Trophy className="mr-2 inline size-4 text-green" />
                  {a.title}
                </span>
                <span className="text-ink-3">{new Date(a.unlockedAt!).toLocaleString()}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
