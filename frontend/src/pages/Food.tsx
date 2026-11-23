import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Clock, Heart, Pencil, Plus, ScanLine, Search, Sparkles, Star, Trash2, Utensils } from "lucide-react";
import { useDashboard, useFoodEntries } from "../hooks/useData";
import { api } from "../services/api";
import { createRecord, deleteRecord } from "../services/offline";
import { useToast } from "../context/ToastContext";
import { DateNav, EmptyState, Field, Modal, PageHeader, PageLoader, PendingBadge, ProgressBar, Select, Segmented, Spinner } from "../components/ui";
import { NutrientInputs, emptyNutrients, scaleNutrients } from "../components/NutrientInputs";
import { MEALS, fmtNum, fmtTime, suggestMeal, todayKey } from "../utils/format";
import type { FoodEntry, FoodItem, MealType, Nutrients } from "../utils/types";

const pickNutrients = (x: Nutrients): Nutrients => ({
  calories: x.calories, proteinG: x.proteinG, carbsG: x.carbsG, fatG: x.fatG, fiberG: x.fiberG, sugarG: x.sugarG, sodiumMg: x.sodiumMg,
});

/** Timestamp for an entry on the selected diary date (now for today, midday otherwise). */
const eatenAtFor = (date: string) => (date === todayKey() ? new Date() : new Date(`${date}T12:00:00`)).toISOString();

type Tab = "search" | "recent" | "favorites" | "manual";

function AddFoodModal({ open, onClose, date, meal }: { open: boolean; onClose: () => void; date: string; meal: MealType }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("search");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<{ name: string; servingDesc: string; base: Nutrients; source: string; foodItemId?: string } | null>(null);
  const [servings, setServings] = useState(1);
  const [mealType, setMealType] = useState<MealType>(meal);
  const [manual, setManual] = useState({ name: "", portion: "", n: emptyNutrients() });
  const [saveFav, setSaveFav] = useState(false);
  const [busy, setBusy] = useState(false);

  const search = useQuery({
    queryKey: ["foodSearch", q],
    queryFn: () => api<{ items: FoodItem[] }>(`/food/search?q=${encodeURIComponent(q)}`),
    enabled: open && tab === "search",
    staleTime: 5 * 60_000,
  });
  const recent = useQuery({ queryKey: ["foodRecent"], queryFn: () => api<{ items: FoodEntry[] }>("/food/recent"), enabled: open && tab === "recent" });
  const favs = useQuery({ queryKey: ["foodFavorites"], queryFn: () => api<{ items: FoodItem[] }>("/food/favorites"), enabled: open && tab === "favorites" });

  const reset = () => {
    setSelected(null);
    setServings(1);
    setManual({ name: "", portion: "", n: emptyNutrients() });
    setSaveFav(false);
  };
  const close = () => {
    reset();
    onClose();
  };

  async function save(entry: { name: string; portionDesc?: string; n: Nutrients; servings: number; source: string; foodItemId?: string }) {
    setBusy(true);
    try {
      const r = await createRecord<FoodEntry>(qc, "food", {
        mealType,
        name: entry.name,
        servings: entry.servings,
        portionDesc: entry.portionDesc || null,
        ...entry.n,
        source: entry.source,
        foodItemId: entry.foodItemId ?? null,
        eatenAt: eatenAtFor(date),
      });
      if (saveFav && !r.queued) {
        await api("/food/items", {
          method: "POST",
          json: { name: entry.name, servingDesc: entry.portionDesc || "1 serving", ...scaleNutrients(entry.n, 1), isFavorite: true },
        }).catch(() => undefined);
        qc.invalidateQueries({ queryKey: ["foodFavorites"] });
      }
      toast.show(r.queued ? `${entry.name} saved offline — will sync later` : `${entry.name} added`, "success");
      r.unlocked?.forEach((a) => toast.achievement(a.title));
      close();
    } catch (e) {
      toast.show((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const list: Array<{ key: string; name: string; desc: string; n: Nutrients; source: string; foodItemId?: string }> =
    tab === "search"
      ? (search.data?.items ?? []).map((i) => ({ key: i.id, name: i.name, desc: i.servingDesc, n: pickNutrients(i), source: i.userId ? "favorite" : "database", foodItemId: i.id }))
      : tab === "recent"
        ? (recent.data?.items ?? []).map((i) => ({
            key: i.id,
            name: i.name,
            desc: i.portionDesc ?? `${i.servings} serving`,
            n: scaleNutrients(pickNutrients(i), 1 / (i.servings || 1)),
            source: "recent",
          }))
        : (favs.data?.items ?? []).map((i) => ({ key: i.id, name: i.name, desc: i.servingDesc, n: pickNutrients(i), source: "favorite", foodItemId: i.id }));
  const loading = (tab === "search" && search.isLoading) || (tab === "recent" && recent.isLoading) || (tab === "favorites" && favs.isLoading);

  return (
    <Modal open={open} onClose={close} title={selected ? selected.name : "Add food"} wide>
      {selected ? (
        <div className="space-y-4">
          <p className="text-sm text-ink-2">Per serving: {selected.servingDesc}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Servings" type="number" min={0.25} step={0.25} value={servings} onChange={(e) => setServings(Math.max(0.05, Number(e.target.value) || 0))} />
            <Select label="Meal" value={mealType} onChange={(e) => setMealType(e.target.value as MealType)} options={MEALS} />
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {(() => {
              const n = scaleNutrients(selected.base, servings);
              return [
                ["kcal", n.calories],
                ["Protein", `${n.proteinG}g`],
                ["Carbs", `${n.carbsG}g`],
                ["Fat", `${n.fatG}g`],
              ].map(([l, v]) => (
                <div key={String(l)} className="rounded-2xl bg-card-2 p-3">
                  <div className="font-display text-lg font-bold">{v}</div>
                  <div className="text-xs text-ink-3">{l}</div>
                </div>
              ));
            })()}
          </div>
          <div className="flex gap-3">
            <button className="btn-ghost" onClick={() => setSelected(null)}>
              Back
            </button>
            <button
              className="btn-primary flex-1"
              disabled={busy}
              onClick={() =>
                save({
                  name: selected.name,
                  portionDesc: `${servings} × ${selected.servingDesc}`,
                  n: scaleNutrients(selected.base, servings),
                  servings,
                  source: selected.source,
                  foodItemId: selected.foodItemId,
                })
              }
            >
              {busy ? <Spinner className="size-4 text-on-green" /> : "Add to diary"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <Segmented<Tab>
              label="Add food method"
              value={tab}
              onChange={setTab}
              options={[
                { value: "search", label: "Search" },
                { value: "recent", label: "Recent" },
                { value: "favorites", label: "Favourites" },
                { value: "manual", label: "Manual" },
              ]}
            />
          </div>

          {tab === "manual" ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                save({ name: manual.name, portionDesc: manual.portion, n: manual.n, servings: 1, source: "manual" });
              }}
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <Field label="Food name" required value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} />
                </div>
                <Select label="Meal" value={mealType} onChange={(e) => setMealType(e.target.value as MealType)} options={MEALS} />
              </div>
              <Field label="Portion" placeholder="e.g. 1 bowl, 200 g" value={manual.portion} onChange={(e) => setManual({ ...manual, portion: e.target.value })} />
              <NutrientInputs value={manual.n} onChange={(n) => setManual({ ...manual, n })} />
              <label className="flex items-center gap-2 text-sm text-ink-2">
                <input type="checkbox" checked={saveFav} onChange={(e) => setSaveFav(e.target.checked)} className="accent-[var(--green)]" />
                Save to favourites
              </label>
              <button className="btn-primary w-full" disabled={busy || !manual.name.trim()}>
                {busy ? <Spinner className="size-4 text-on-green" /> : "Add to diary"}
              </button>
            </form>
          ) : (
            <>
              {tab === "search" && (
                <div className="relative">
                  <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
                  <input className="input pl-9" placeholder="Search foods (e.g. idli, chicken, oats)" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
                </div>
              )}
              {loading ? (
                <div className="grid h-32 place-items-center">
                  <Spinner />
                </div>
              ) : list.length === 0 ? (
                <EmptyState icon={tab === "favorites" ? <Heart className="size-5" /> : <Search className="size-5" />} title="Nothing here yet">
                  {tab === "favorites" ? "Tick “Save to favourites” when adding a manual entry." : tab === "recent" ? "Foods you log will show up here." : "Try another search, or add it manually."}
                </EmptyState>
              ) : (
                <ul className="max-h-[50dvh] divide-y divide-line overflow-y-auto">
                  {list.map((i) => (
                    <li key={i.key}>
                      <button
                        className="flex w-full items-center gap-3 py-3 text-left hover:text-green"
                        onClick={() => setSelected({ name: i.name, servingDesc: i.desc, base: i.n, source: i.source, foodItemId: i.foodItemId })}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{i.name}</div>
                          <div className="text-xs text-ink-3">
                            {i.desc} · P {i.n.proteinG}g · C {i.n.carbsG}g · F {i.n.fatG}g
                          </div>
                        </div>
                        <span className="font-display font-semibold tabular-nums">{Math.round(i.n.calories)}</span>
                        <Plus className="size-4 text-green" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

function EditEntryModal({ entry, onClose }: { entry: FoodEntry | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState(entry?.name ?? "");
  const [mealType, setMealType] = useState<MealType>(entry?.mealType ?? "other");
  const [n, setN] = useState<Nutrients>(entry ? pickNutrients(entry) : emptyNutrients());
  const [busy, setBusy] = useState(false);
  if (!entry) return null;
  return (
    <Modal open onClose={onClose} title="Edit entry" wide>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api(`/food/entries/${entry.id}`, { method: "PATCH", json: { name, mealType, ...n } });
            for (const k of ["food", "dashboard", "analytics"]) qc.invalidateQueries({ queryKey: [k] });
            toast.show("Entry updated", "success");
            onClose();
          } catch (err) {
            toast.show((err as Error).message, "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Field label="Food name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <Select label="Meal" value={mealType} onChange={(e) => setMealType(e.target.value as MealType)} options={MEALS} />
        </div>
        <NutrientInputs value={n} onChange={setN} />
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? <Spinner className="size-4 text-on-green" /> : "Save changes"}
        </button>
      </form>
    </Modal>
  );
}

export default function Food() {
  const [date, setDate] = useState(todayKey());
  const { data, isLoading } = useFoodEntries(date);
  const dash = useDashboard(date);
  const qc = useQueryClient();
  const toast = useToast();
  const [adding, setAdding] = useState<MealType | null>(null);
  const [editing, setEditing] = useState<FoodEntry | null>(null);
  const goals = dash.data?.goals;

  const entries = data?.entries ?? [];
  const totals = useMemo(
    () =>
      entries.reduce(
        (t, e) => ({
          calories: t.calories + e.calories, proteinG: t.proteinG + e.proteinG, carbsG: t.carbsG + e.carbsG, fatG: t.fatG + e.fatG,
          fiberG: t.fiberG + (e.fiberG ?? 0), sugarG: t.sugarG + (e.sugarG ?? 0), sodiumMg: t.sodiumMg + (e.sodiumMg ?? 0),
        }),
        emptyNutrients(),
      ),
    [entries],
  );

  async function remove(e: FoodEntry) {
    try {
      const r = await deleteRecord(qc, "food", e);
      toast.show(r.queued ? "Deleted offline — will sync later" : "Entry deleted", "success");
    } catch (err) {
      toast.show((err as Error).message, "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Food diary"
        subtitle={`${fmtNum(totals.calories)} of ${fmtNum(goals?.dailyCalorieTarget ?? 0)} kcal`}
        action={
          <div className="flex gap-2">
            <DateNav value={date} onChange={setDate} />
            <Link to="/scan" className="btn-primary" aria-label="Scan food">
              <ScanLine className="size-4" /> <span className="hidden sm:inline">Scan</span>
            </Link>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {isLoading ? (
            <PageLoader />
          ) : (
            MEALS.map((m) => {
              const items = entries.filter((e) => e.mealType === m.value);
              const kcal = items.reduce((t, e) => t + e.calories, 0);
              if (m.value === "other" && items.length === 0) return null;
              return (
                <section key={m.value} className="card p-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display font-semibold">
                      {m.label} <span className="ml-1 text-sm font-normal text-ink-3">{fmtNum(kcal)} kcal</span>
                    </h2>
                    <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => setAdding(m.value)} aria-label={`Add food to ${m.label}`}>
                      <Plus className="size-3.5" /> Add
                    </button>
                  </div>
                  {items.length > 0 && (
                    <ul className="mt-3 divide-y divide-line">
                      {items.map((e) => (
                        <li key={e.id} className="flex items-center gap-3 py-2.5">
                          {e.imageUrl ? (
                            <img src={e.imageUrl} alt="" className="size-11 rounded-xl object-cover" loading="lazy" />
                          ) : (
                            <span className="grid size-11 place-items-center rounded-xl bg-card-2 text-ink-3">
                              {e.source === "ai_scan" ? <Sparkles className="size-4" /> : e.source === "favorite" ? <Star className="size-4" /> : e.source === "recent" ? <Clock className="size-4" /> : <Utensils className="size-4" />}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                              <span className="truncate">{e.name}</span>
                              {e.pending && <PendingBadge />}
                              {e.source === "ai_scan" && (
                                <span className="rounded-full bg-green/10 px-2 py-0.5 text-[10px] font-semibold text-green">AI estimate</span>
                              )}
                            </div>
                            <div className="text-xs text-ink-3">
                              {fmtTime(e.eatenAt)}
                              {e.portionDesc ? ` · ${e.portionDesc}` : ""} · P {fmtNum(e.proteinG, 1)} · C {fmtNum(e.carbsG, 1)} · F {fmtNum(e.fatG, 1)}
                            </div>
                          </div>
                          <span className="font-display font-semibold tabular-nums">{fmtNum(e.calories)}</span>
                          {!e.pending && (
                            <button className="p-1.5 text-ink-3 hover:text-ink" onClick={() => setEditing(e)} aria-label={`Edit ${e.name}`}>
                              <Pencil className="size-4" />
                            </button>
                          )}
                          <button className="p-1.5 text-ink-3 hover:text-danger" onClick={() => remove(e)} aria-label={`Delete ${e.name}`}>
                            <Trash2 className="size-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })
          )}
        </div>

        <aside className="card h-fit space-y-4 lg:sticky lg:top-8">
          <h2 className="font-display font-semibold">Daily totals</h2>
          <ProgressBar label="Calories" value={totals.calories} max={goals?.dailyCalorieTarget ?? 2000} unit="kcal" />
          <ProgressBar label="Protein" value={totals.proteinG} max={goals?.proteinTargetG ?? 100} />
          <ProgressBar label="Carbs" value={totals.carbsG} max={goals?.carbsTargetG ?? 250} />
          <ProgressBar label="Fat" value={totals.fatG} max={goals?.fatTargetG ?? 65} />
          <ProgressBar label="Fibre" value={totals.fiberG} max={goals?.fiberTargetG ?? 30} />
          <ProgressBar label="Sugar" value={totals.sugarG} max={50} unit="g" color="var(--series-3)" />
          <ProgressBar label="Sodium" value={totals.sodiumMg} max={2300} unit="mg" color="var(--series-2)" />
          <p className="text-xs text-ink-3">Sugar and sodium limits follow WHO / dietary-guideline upper limits (50 g, 2,300 mg).</p>
        </aside>
      </div>

      <AddFoodModal key={adding ?? "closed"} open={adding !== null} onClose={() => setAdding(null)} date={date} meal={adding ?? suggestMeal()} />
      <EditEntryModal key={editing?.id ?? "none"} entry={editing} onClose={() => setEditing(null)} />
      <div className={clsx("fixed right-5 bottom-24 lg:hidden", adding && "hidden")}>
        <button className="btn-primary size-14 rounded-2xl p-0" onClick={() => setAdding(suggestMeal())} aria-label="Add food">
          <Plus className="size-6" />
        </button>
      </div>
    </div>
  );
}
