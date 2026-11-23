import { Link } from "react-router-dom";
import { BarChart3, Bot, ChevronRight, Droplet, LogOut, Moon, Ruler, Settings, Trophy } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { PageHeader } from "../components/ui";

const LINKS = [
  { to: "/water", label: "Water", icon: Droplet },
  { to: "/sleep", label: "Sleep", icon: Moon },
  { to: "/body", label: "Body measurements", icon: Ruler },
  { to: "/analytics", label: "Analytics & reports", icon: BarChart3 },
  { to: "/assistant", label: "AI fitness coach", icon: Bot },
  { to: "/achievements", label: "Achievements", icon: Trophy },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function More() {
  const { user, logout } = useAuth();
  return (
    <div>
      <PageHeader title="More" subtitle={user?.email} />
      <div className="card divide-y divide-line p-0">
        {LINKS.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="flex items-center gap-3 px-5 py-4 hover:bg-card-2">
            <span className="grid size-9 place-items-center rounded-xl bg-green/10 text-green">
              <Icon className="size-5" />
            </span>
            <span className="flex-1 font-medium">{label}</span>
            <ChevronRight className="size-4 text-ink-3" />
          </Link>
        ))}
      </div>
      <button className="btn-ghost mt-5 w-full text-danger" onClick={logout}>
        <LogOut className="size-4" /> Log out
      </button>
    </div>
  );
}
