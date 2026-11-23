import type { Nutrients } from "../utils/types";

const FIELDS: { key: keyof Nutrients; label: string; unit: string }[] = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "proteinG", label: "Protein", unit: "g" },
  { key: "carbsG", label: "Carbs", unit: "g" },
  { key: "fatG", label: "Fat", unit: "g" },
  { key: "fiberG", label: "Fibre", unit: "g" },
  { key: "sugarG", label: "Sugar", unit: "g" },
  { key: "sodiumMg", label: "Sodium", unit: "mg" },
];

export const emptyNutrients = (): Nutrients => ({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, sodiumMg: 0 });

export const scaleNutrients = (n: Nutrients, factor: number): Nutrients =>
  Object.fromEntries(Object.entries(n).map(([k, v]) => [k, Math.round(Number(v) * factor * 10) / 10])) as Nutrients;

export function NutrientInputs({ value, onChange }: { value: Nutrients; onChange: (n: Nutrients) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {FIELDS.map((f) => (
        <label key={f.key} className={f.key === "calories" ? "col-span-2 sm:col-span-1" : ""}>
          <span className="label">
            {f.label} <span className="normal-case">({f.unit})</span>
          </span>
          <input
            className="input tabular-nums"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.1"
            value={Number.isFinite(value[f.key]) ? value[f.key] : ""}
            onChange={(e) => onChange({ ...value, [f.key]: e.target.value === "" ? 0 : Number(e.target.value) })}
          />
        </label>
      ))}
    </div>
  );
}
