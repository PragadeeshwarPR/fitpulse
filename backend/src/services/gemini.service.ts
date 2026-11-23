/**
 * Google Gemini integration. The API key lives only on the server; the frontend
 * calls our authenticated endpoints and never sees it.
 */
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/errors.js";
import { localMidnightUtc } from "../utils/dates.js";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };
type Content = { role: "user" | "model"; parts: Part[] };

export type FoodScanResult = {
  isFood: boolean;
  foodName: string;
  items: Array<{
    name: string;
    portion: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number;
    sugarG: number;
    sodiumMg: number;
  }>;
  ingredients: string[];
  portionDescription: string;
  totals: { calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number; sugarG: number; sodiumMg: number };
  confidence: number;
  needsClarification: boolean;
  clarificationQuestion: string | null;
  notes: string;
};

const num = { type: "NUMBER" };
const NUTRIENTS = { calories: num, proteinG: num, carbsG: num, fatG: num, fiberG: num, sugarG: num, sodiumMg: num };
const FOOD_SCHEMA = {
  type: "OBJECT",
  properties: {
    isFood: { type: "BOOLEAN" },
    foodName: { type: "STRING" },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { name: { type: "STRING" }, portion: { type: "STRING" }, ...NUTRIENTS },
        required: ["name", "portion", ...Object.keys(NUTRIENTS)],
      },
    },
    ingredients: { type: "ARRAY", items: { type: "STRING" } },
    portionDescription: { type: "STRING" },
    totals: { type: "OBJECT", properties: NUTRIENTS, required: Object.keys(NUTRIENTS) },
    confidence: { type: "NUMBER" },
    needsClarification: { type: "BOOLEAN" },
    clarificationQuestion: { type: "STRING", nullable: true },
    notes: { type: "STRING" },
  },
  required: ["isFood", "foodName", "items", "ingredients", "portionDescription", "totals", "confidence", "needsClarification", "notes"],
};

const FOOD_PROMPT = `You are a nutrition analysis assistant. Analyse the food photograph.
- Identify each distinct food item, its likely ingredients and the visible portion size (count pieces, estimate grams or cups).
- Estimate calories (kcal), protein, carbohydrates, fat, fibre, sugar (grams) and sodium (mg) per item, and the totals for the whole plate.
- Recognise regional cuisines accurately (e.g. Indian: idli, dosa, sambar, chapati, biryani).
- "confidence" is 0..1 reflecting how certain you are of identification AND portion size.
- If identification or portion is uncertain (confidence < 0.6, hidden ingredients, ambiguous dish), set needsClarification=true and ask ONE short, specific clarificationQuestion.
- If the image is not food, set isFood=false, confidence=0 and zero nutrients.
- All values are estimates; never claim exact measurements. Round sensibly.`;

const ASSISTANT_SYSTEM = `You are FitPulse Coach, a friendly, knowledgeable fitness and nutrition assistant inside the FitPulse app.
Scope: nutrition, exercise, weight management, muscle building, recovery, sleep, hydration and healthy habits.
Rules:
- Be practical and concise. Use short paragraphs and bullet points; give concrete numbers when helpful.
- Personalise using the user context provided (if any), but do not repeat it back verbatim.
- You are not a doctor. Never diagnose diseases, interpret symptoms as conditions, or prescribe medication or supplements doses for medical purposes.
- If the user mentions chest pain, fainting, disordered eating, injury, pregnancy, a medical condition or medication, advise consulting a qualified healthcare professional and keep suggestions general.
- Do not recommend extreme diets (below ~1200 kcal/day) or unsafe training.
- If asked about something outside fitness and health, politely steer back.`;

async function assertQuota(userId: string) {
  const used = await prisma.aiUsageLog.count({
    where: { userId, createdAt: { gte: localMidnightUtc(new Date(), 0) } },
  });
  if (used >= env.AI_DAILY_LIMIT) {
    throw new HttpError(429, "ai_quota", `Daily AI limit of ${env.AI_DAILY_LIMIT} requests reached. Try again tomorrow.`);
  }
}

async function generate(
  userId: string,
  feature: string,
  body: { contents: Content[]; systemInstruction?: string; responseSchema?: object; temperature?: number },
): Promise<string> {
  await assertQuota(userId);
  if (!env.GEMINI_API_KEY && !env.GEMINI_MOCK) {
    throw new HttpError(503, "ai_unavailable", "AI features are not configured on this server.");
  }
  const started = Date.now();
  const log = (success: boolean, extra: { inputTokens?: number; outputTokens?: number; errorCode?: string } = {}) =>
    prisma.aiUsageLog.create({
      data: { userId, feature, model: env.GEMINI_MOCK ? "mock" : env.GEMINI_MODEL, success, latencyMs: Date.now() - started, ...extra },
    });

  if (env.GEMINI_MOCK) {
    await log(true);
    return mockResponse(feature);
  }

  try {
    type GeminiJson = {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      error?: { message?: string; status?: string };
    };
    const payload = JSON.stringify({
      contents: body.contents,
      systemInstruction: body.systemInstruction ? { parts: [{ text: body.systemInstruction }] } : undefined,
      generationConfig: {
        temperature: body.temperature ?? 0.4,
        ...(body.responseSchema ? { responseMimeType: "application/json", responseSchema: body.responseSchema } : {}),
      },
    });
    // Google sometimes answers 429/5xx during demand spikes. Retry with a short backoff, then try the
    // optional fallback model, while staying inside the serverless function's time limit.
    // 429 (rate limit) is not retried: retrying would only burn more of the per-minute quota.
    const RETRYABLE = new Set([500, 502, 503, 504]);
    const models = [env.GEMINI_MODEL, env.GEMINI_FALLBACK_MODEL].filter((m, i, all) => m && all.indexOf(m) === i);
    let res: Response | null = null;
    let json: GeminiJson = {};
    outer: for (const model of models) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        if (Date.now() - started > 40_000) break outer;
        res = await fetch(`${BASE}/${model}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
          signal: AbortSignal.timeout(20_000),
          body: payload,
        });
        json = (await res.json().catch(() => ({}))) as GeminiJson;
        if (res.ok) break outer;
        console.error("Gemini error", res.status, model, `attempt ${attempt}`, json.error?.message);
        if (!RETRYABLE.has(res.status)) break outer;
        await new Promise((r) => setTimeout(r, 1200 * attempt));
      }
    }
    if (!res || !res.ok) {
      await log(false, { errorCode: json.error?.status ?? String(res?.status ?? "none") });
      if (res?.status === 429) {
        const wait = /retry in (\d+)/i.exec(json.error?.message ?? "")?.[1];
        throw new HttpError(429, "ai_rate_limited", `AI request limit reached. Please wait ${wait ? `${wait} seconds` : "a minute"} and try again.`);
      }
      if (res && RETRYABLE.has(res.status)) {
        throw new HttpError(503, "ai_busy", "The AI service is very busy right now. Please try again in a minute.");
      }
      throw new HttpError(502, "ai_error", "The AI service could not process this request. Please try again.");
    }
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    await log(Boolean(text), {
      inputTokens: json.usageMetadata?.promptTokenCount,
      outputTokens: json.usageMetadata?.candidatesTokenCount,
      errorCode: text ? undefined : json.candidates?.[0]?.finishReason ?? "empty",
    });
    if (!text) throw new HttpError(502, "ai_empty", "The AI returned no answer. Please rephrase or try again.");
    return text;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    await log(false, { errorCode: (e as Error).name });
    throw new HttpError(504, "ai_timeout", "The AI service did not respond in time. Please try again.");
  }
}

const clamp = (n: unknown, max = 20000) => Math.min(max, Math.max(0, Math.round((Number(n) || 0) * 10) / 10));

export async function analyzeFoodImage(userId: string, image: Buffer, mimeType: string, hint?: string): Promise<FoodScanResult> {
  const text = await generate(userId, "food_scan", {
    contents: [
      {
        role: "user",
        parts: [
          { inline_data: { mime_type: mimeType, data: image.toString("base64") } },
          { text: hint ? `${FOOD_PROMPT}\n\nUser clarification: ${hint.slice(0, 300)}` : FOOD_PROMPT },
        ],
      },
    ],
    responseSchema: FOOD_SCHEMA,
    temperature: 0.2,
  });
  let r: FoodScanResult;
  try {
    r = JSON.parse(text);
  } catch {
    throw new HttpError(502, "ai_parse", "Could not read the AI analysis. Please try another photo.");
  }
  // Sanitise numbers coming back from the model.
  const n = (o: Partial<FoodScanResult["totals"]>) => ({
    calories: clamp(o.calories),
    proteinG: clamp(o.proteinG),
    carbsG: clamp(o.carbsG),
    fatG: clamp(o.fatG),
    fiberG: clamp(o.fiberG),
    sugarG: clamp(o.sugarG),
    sodiumMg: clamp(o.sodiumMg, 100000),
  });
  const confidence = Math.min(1, Math.max(0, Number(r.confidence) || 0));
  return {
    isFood: Boolean(r.isFood),
    foodName: String(r.foodName ?? "Unknown food").slice(0, 120),
    items: (r.items ?? []).slice(0, 20).map((i) => ({ name: String(i.name).slice(0, 120), portion: String(i.portion ?? "").slice(0, 120), ...n(i) })),
    ingredients: (r.ingredients ?? []).slice(0, 30).map((s) => String(s).slice(0, 60)),
    portionDescription: String(r.portionDescription ?? "").slice(0, 200),
    totals: n(r.totals ?? {}),
    confidence,
    // Force clarification for low-confidence results regardless of what the model said.
    needsClarification: Boolean(r.needsClarification) || confidence < 0.6,
    clarificationQuestion: r.clarificationQuestion ?? (confidence < 0.6 ? "Can you describe the dish and portion size?" : null),
    notes: String(r.notes ?? "").slice(0, 500),
  };
}

export async function chat(userId: string, history: Content[], userContext: string | null) {
  const system = userContext ? `${ASSISTANT_SYSTEM}\n\nUser context (shared with consent):\n${userContext}` : ASSISTANT_SYSTEM;
  return generate(userId, "assistant", { contents: history, systemInstruction: system, temperature: 0.7 });
}

export async function dailyInsight(userId: string, userContext: string) {
  return generate(userId, "insight", {
    systemInstruction: ASSISTANT_SYSTEM,
    temperature: 0.6,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Based on my data below, give me ONE short, encouraging, actionable insight for today (max 45 words, no greeting, no medical claims).\n\n${userContext}`,
          },
        ],
      },
    ],
  });
}

function mockResponse(feature: string) {
  if (feature === "food_scan") {
    return JSON.stringify({
      isFood: true,
      foodName: "Idli with Sambar",
      items: [
        { name: "Idli", portion: "3 pieces (~150 g)", calories: 210, proteinG: 6, carbsG: 45, fatG: 1, fiberG: 2, sugarG: 0.5, sodiumMg: 360 },
        { name: "Sambar", portion: "1 cup (~200 ml)", calories: 140, proteinG: 6, carbsG: 17, fatG: 4, fiberG: 4, sugarG: 3, sodiumMg: 520 },
      ],
      ingredients: ["rice", "urad dal", "toor dal", "tamarind", "vegetables", "spices"],
      portionDescription: "3 idlis with one bowl of sambar",
      totals: { calories: 350, proteinG: 12, carbsG: 62, fatG: 5, fiberG: 6, sugarG: 3.5, sodiumMg: 880 },
      confidence: 0.82,
      needsClarification: false,
      clarificationQuestion: null,
      notes: "Estimate assumes no ghee or chutney.",
    });
  }
  if (feature === "insight") return "You're 2,000 steps from your goal - a brisk 20-minute walk after dinner gets you there and helps digestion.";
  return "Here's a practical tip: aim for about 1.6 g of protein per kg of body weight spread across 3-4 meals. (Mock AI response - set GEMINI_API_KEY for real answers.)";
}
