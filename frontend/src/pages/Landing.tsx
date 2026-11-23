import { Link } from "react-router-dom";
import { ArrowRight, Bot, CloudOff, Droplet, Flame, LineChart, Moon, ScanLine, ShieldCheck, Smartphone, Sparkles, Trophy } from "lucide-react";
import { Logo, ProgressRing } from "../components/ui";
import { InstallButton } from "../components/InstallButton";

const FEATURES = [
  { icon: ScanLine, title: "AI food scanner", body: "Snap a plate. Gemini estimates the food, portion, calories and macros, and you review every number before it's saved." },
  { icon: Flame, title: "Activity & calories", body: "Log 13 activity types or record GPS walks, runs and rides. Calories are estimated from MET values, your weight and pace." },
  { icon: LineChart, title: "Progress analytics", body: "Daily, weekly and monthly trends for nutrition, steps, sleep, hydration and weight, with date filters." },
  { icon: Bot, title: "AI fitness coach", body: "Ask about protein, workouts or meal ideas. Answers are personalised with the data you choose to share." },
  { icon: Droplet, title: "Water & sleep", body: "One-tap hydration logging, sleep duration and quality, consistency insights and gentle reminders." },
  { icon: CloudOff, title: "Works offline", body: "Install it like an app. Meals, workouts, water and sleep save offline and sync when you're back online." },
];

export default function Landing() {
  return (
    <div className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute -top-60 right-[-10%] size-[700px] rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--green), transparent 60%)" }}
        aria-hidden
      />
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          <InstallButton compact />
          <Link to="/login" className="btn px-3 text-ink-2 hover:text-ink">
            Log in
          </Link>
          <Link to="/signup" className="btn-primary hidden sm:inline-flex">
            Get started
          </Link>
        </nav>
      </header>

      <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pt-10 pb-20 lg:grid-cols-2 lg:pt-20">
        <div className="animate-rise">
          <span className="chip chip-active inline-flex items-center gap-1.5">
            <Sparkles className="size-3.5" /> Powered by Gemini AI
          </span>
          <h1 className="mt-5 font-display text-5xl leading-[1.05] font-bold tracking-tight sm:text-6xl">
            Your body,
            <br />
            <span className="glow-text text-green">decoded.</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-ink-2">
            FitPulse brings activity, nutrition, sleep and hydration into one dashboard, with AI food scanning and a personal coach that
            knows your goals.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup" className="btn-primary px-6 py-3 text-base">
              Start free <ArrowRight className="size-4" />
            </Link>
            <Link to="/login" className="btn-ghost px-6 py-3 text-base">
              I have an account
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-5 text-sm text-ink-3">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-green" /> Private by design
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Smartphone className="size-4 text-green" /> Installable PWA
            </span>
          </div>
        </div>

        {/* Product preview */}
        <div className="animate-rise relative mx-auto w-full max-w-md" style={{ animationDelay: "120ms" }} aria-hidden>
          <div className="card relative p-6" style={{ boxShadow: "0 30px 80px -20px rgb(57 255 120 / 0.18)" }}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-display font-semibold">Today</span>
              <span className="text-ink-3">Calories</span>
            </div>
            <div className="my-4 flex justify-center">
              <ProgressRing value={1460} max={2100} label="Calories">
                <div>
                  <div className="font-display text-3xl font-bold">640</div>
                  <div className="text-xs text-ink-3">kcal left</div>
                </div>
              </ProgressRing>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ["Protein", "92g"],
                ["Carbs", "168g"],
                ["Fat", "41g"],
              ].map(([l, v]) => (
                <div key={l} className="rounded-2xl bg-card-2 p-3">
                  <div className="font-display text-lg font-bold">{v}</div>
                  <div className="text-xs text-ink-3">{l}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-green/30 bg-green/5 p-3">
              <div className="grid size-10 place-items-center rounded-xl bg-green/15 text-green">
                <ScanLine className="size-5" />
              </div>
              <div className="text-sm">
                <div className="font-medium">Idli with Sambar · 350 kcal</div>
                <div className="text-xs text-ink-3">AI estimate · 82% confidence · edited by you</div>
              </div>
            </div>
          </div>
          <div className="card absolute -bottom-6 -left-6 hidden items-center gap-3 p-3 sm:flex">
            <Trophy className="size-5 text-green" />
            <div className="text-sm font-medium">10K Club unlocked</div>
          </div>
          <div className="card absolute -top-5 -right-4 hidden items-center gap-2 p-3 text-sm sm:flex">
            <Moon className="size-4 text-green" /> 7h 42m sleep
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-5 pb-20">
        <h2 className="heading mb-8 text-center text-3xl">Everything in one place</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="card transition hover:border-green/40">
              <div className="mb-4 grid size-11 place-items-center rounded-2xl bg-green/10 text-green">
                <Icon className="size-5" />
              </div>
              <h3 className="font-display text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{body}</p>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-10 max-w-2xl text-center text-xs leading-relaxed text-ink-3">
          FitPulse gives estimates for nutrition and calories burned. It isn't medical advice. Browsers can't count steps continuously in
          the background, so FitPulse counts steps while the app is open and always lets you enter them by hand.
        </p>
      </section>

      <footer className="border-t border-line py-8 text-center text-xs text-ink-3">© {new Date().getFullYear()} FitPulse</footer>
    </div>
  );
}
