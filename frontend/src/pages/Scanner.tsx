import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { AlertTriangle, Camera, Check, HelpCircle, ImagePlus, RotateCcw, Sparkles, WifiOff, X } from "lucide-react";
import { api, ApiError } from "../services/api";
import { createRecord } from "../services/offline";
import { useToast } from "../context/ToastContext";
import { Field, PageHeader, Select, Spinner } from "../components/ui";
import { CameraCapture } from "../components/CameraCapture";
import { NutrientInputs, scaleNutrients } from "../components/NutrientInputs";
import { compressImage } from "../utils/image";
import { MEALS, suggestMeal } from "../utils/format";
import type { MealType, Nutrients } from "../utils/types";

type Analysis = {
  isFood: boolean;
  foodName: string;
  items: Array<Nutrients & { name: string; portion: string }>;
  ingredients: string[];
  portionDescription: string;
  totals: Nutrients;
  confidence: number;
  needsClarification: boolean;
  clarificationQuestion: string | null;
  notes: string;
};

function confidenceLevel(c: number) {
  if (c >= 0.8) return { label: "High confidence", cls: "bg-green/15 text-green", icon: Check };
  if (c >= 0.6) return { label: "Medium confidence", cls: "bg-warn/15 text-warn", icon: HelpCircle };
  return { label: "Low confidence", cls: "bg-danger/15 text-danger", icon: AlertTriangle };
}

const PORTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function Scanner() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [image, setImage] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [hint, setHint] = useState("");
  // Editable result
  const [name, setName] = useState("");
  const [portionDesc, setPortionDesc] = useState("");
  const [base, setBase] = useState<Nutrients | null>(null); // nutrients at 1x portion
  const [factor, setFactor] = useState(1);
  const [values, setValues] = useState<Nutrients | null>(null);
  const [meal, setMeal] = useState<MealType>(suggestMeal());
  const [saving, setSaving] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function choose(blob: Blob) {
    setCameraOpen(false);
    setAnalysis(null);
    setError(null);
    const small = await compressImage(blob);
    setImage(small);
    setPreview(URL.createObjectURL(small));
  }

  async function analyse(withHint?: string) {
    if (!image) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("image", image, "meal.jpg");
      if (withHint) fd.append("hint", withHint);
      const r = await api<{ analysis: Analysis; imageUrl: string | null }>("/food/scan", { method: "POST", body: fd });
      setAnalysis(r.analysis);
      setImageUrl(r.imageUrl);
      setName(r.analysis.foodName);
      setPortionDesc(r.analysis.portionDescription);
      setBase(r.analysis.totals);
      setFactor(1);
      setValues(r.analysis.totals);
      setHint("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't reach the AI service. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function changePortion(f: number) {
    if (!base) return;
    setFactor(f);
    setValues(scaleNutrients(base, f));
  }

  function editValues(n: Nutrients) {
    setValues(n);
    setBase(scaleNutrients(n, 1 / factor)); // user edits define the new 1x baseline
  }

  async function confirm() {
    if (!analysis || !values) return;
    setSaving(true);
    try {
      const r = await createRecord(qc, "food", {
        mealType: meal,
        name: name.trim() || analysis.foodName,
        servings: factor,
        portionDesc: factor === 1 ? portionDesc : `${factor}× ${portionDesc}`,
        ...values,
        source: "ai_scan",
        aiConfidence: analysis.confidence,
        aiRaw: analysis,
        imageUrl,
        eatenAt: new Date().toISOString(),
      });
      toast.show(r.queued ? "Saved offline — will sync later" : "Meal added to your diary", "success");
      r.unlocked?.forEach((a) => toast.achievement(a.title));
      nav("/food");
    } catch (e) {
      toast.show((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setImage(null);
    setPreview(null);
    setAnalysis(null);
    setError(null);
  }

  const conf = analysis ? confidenceLevel(analysis.confidence) : null;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="AI food scanner" subtitle="Photograph your meal. Review the estimate before saving." />

      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) choose(f);
          e.target.value = "";
        }}
      />
      <CameraCapture open={cameraOpen} onClose={() => setCameraOpen(false)} onCapture={choose} onFallback={() => { setCameraOpen(false); fileInput.current?.click(); }} />

      {!online && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-warn/40 bg-warn/10 p-4 text-sm">
          <WifiOff className="mt-0.5 size-4 shrink-0 text-warn" />
          <div>
            AI scanning needs an internet connection. You can still{" "}
            <Link to="/food" className="font-semibold text-green underline">
              log food manually
            </Link>{" "}
            and it will sync later.
          </div>
        </div>
      )}

      {!preview ? (
        <div className="card flex flex-col items-center gap-6 py-12 text-center">
          <div className="relative grid size-24 place-items-center rounded-3xl bg-green/10 text-green" style={{ boxShadow: "var(--glow)" }}>
            <Sparkles className="size-10" />
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold">What are you eating?</h2>
            <p className="mt-1 text-sm text-ink-2">Good lighting and the whole plate in view give the best estimates.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <button className="btn-primary px-6 py-3" onClick={() => setCameraOpen(true)}>
              <Camera className="size-5" /> Take photo
            </button>
            <button className="btn-ghost px-6 py-3" onClick={() => fileInput.current?.click()}>
              <ImagePlus className="size-5" /> Upload image
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-5">
          <div className="md:col-span-2">
            <div className="relative overflow-hidden rounded-3xl border border-line">
              <img src={preview} alt="Meal preview" className="aspect-square w-full object-cover" />
              {busy && (
                <div className="absolute inset-0 grid place-items-center bg-black/55 backdrop-blur-[2px]">
                  <div className="flex flex-col items-center gap-3 text-white">
                    <Spinner className="size-8" />
                    <span className="text-sm font-medium">Analysing your meal…</span>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <button className="btn-ghost flex-1" onClick={reset} disabled={busy}>
                <RotateCcw className="size-4" /> Retake
              </button>
              {!analysis && (
                <button className="btn-primary flex-1" onClick={() => analyse()} disabled={busy || !online}>
                  <Sparkles className="size-4" /> Analyse
                </button>
              )}
            </div>
            {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          </div>

          <div className="space-y-4 md:col-span-3">
            {!analysis ? (
              <div className="card text-sm text-ink-2">
                Tap <b className="text-ink">Analyse</b> to identify the food and estimate calories, protein, carbs, fat and fibre.
              </div>
            ) : !analysis.isFood ? (
              <div className="card space-y-3">
                <div className="flex items-center gap-2 font-semibold text-warn">
                  <AlertTriangle className="size-5" /> This doesn't look like food
                </div>
                <p className="text-sm text-ink-2">{analysis.notes || "Try another photo with the meal clearly visible."}</p>
                <button className="btn-ghost" onClick={reset}>
                  Try another photo
                </button>
              </div>
            ) : (
              <>
                <section className="card space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {conf && (
                      <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", conf.cls)}>
                        <conf.icon className="size-3.5" /> {conf.label} · {Math.round(analysis.confidence * 100)}%
                      </span>
                    )}
                    <span className="text-xs text-ink-3">AI estimate · not a verified measurement</span>
                  </div>
                  <Field label="Food name" value={name} onChange={(e) => setName(e.target.value)} hint="Correct the name if the AI got it wrong." />
                  {analysis.ingredients.length > 0 && (
                    <div>
                      <span className="label">Possible ingredients</span>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.ingredients.map((i) => (
                          <span key={i} className="chip">
                            {i}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {analysis.items.length > 1 && (
                    <div>
                      <span className="label">Detected items</span>
                      <ul className="divide-y divide-line rounded-2xl bg-card-2 px-3">
                        {analysis.items.map((i) => (
                          <li key={i.name} className="flex justify-between gap-3 py-2 text-sm">
                            <span>
                              {i.name} <span className="text-ink-3">· {i.portion}</span>
                            </span>
                            <span className="tabular-nums">{Math.round(i.calories)} kcal</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>

                {analysis.needsClarification && (
                  <section className="card space-y-3 border-warn/40">
                    <div className="flex items-start gap-2 text-sm">
                      <HelpCircle className="mt-0.5 size-4 shrink-0 text-warn" />
                      <span>
                        <b>Help us get this right:</b> {analysis.clarificationQuestion ?? "Can you describe the dish and portion?"}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <input className="input" placeholder="e.g. paneer, not tofu; about 2 cups" value={hint} onChange={(e) => setHint(e.target.value)} />
                      <button className="btn-ghost shrink-0" disabled={!hint.trim() || busy} onClick={() => analyse(hint)}>
                        Re-analyse
                      </button>
                    </div>
                  </section>
                )}

                <section className="card space-y-4">
                  <Field label="Portion" value={portionDesc} onChange={(e) => setPortionDesc(e.target.value)} />
                  <div>
                    <span className="label">Portion size</span>
                    <div className="flex flex-wrap gap-2">
                      {PORTIONS.map((p) => (
                        <button key={p} onClick={() => changePortion(p)} className={clsx("chip", factor === p && "chip-active")}>
                          {p}×
                        </button>
                      ))}
                    </div>
                  </div>
                  {values && <NutrientInputs value={values} onChange={editValues} />}
                  <Select label="Meal" value={meal} onChange={(e) => setMeal(e.target.value as MealType)} options={MEALS} />
                  {analysis.notes && <p className="text-xs text-ink-3">AI note: {analysis.notes}</p>}
                </section>

                <div className="flex gap-3">
                  <button className="btn-ghost flex-1" onClick={reset}>
                    <X className="size-4" /> Reject
                  </button>
                  <button className="btn-primary flex-[2]" onClick={confirm} disabled={saving || !values}>
                    {saving ? <Spinner className="size-4 text-on-green" /> : (<><Check className="size-4" /> Confirm & save</>)}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
