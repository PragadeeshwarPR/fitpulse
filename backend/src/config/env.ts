import { z } from "zod";

// Load backend/.env in development (Node >= 20.12). Production hosts inject env vars directly.
try {
  process.loadEnvFile(".env");
} catch {
  /* no .env file - rely on the real environment */
}

const bool = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  APP_URL: z.string().default("http://localhost:5173"),
  TRUST_PROXY: bool,
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CRON_SECRET: z.string().optional().default(""),
  SESSION_TTL_DAYS: z.coerce.number().default(30),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL: z.string().default("gemini-3.8-flash"),
  // Optional second model tried when the main one is overloaded (e.g. a lighter "flash-lite" model).
  GEMINI_FALLBACK_MODEL: z.string().optional().default(""),
  GEMINI_MOCK: bool,
  AI_DAILY_LIMIT: z.coerce.number().default(50),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(""),
  CLOUDINARY_API_KEY: z.string().optional().default(""),
  CLOUDINARY_API_SECRET: z.string().optional().default(""),
  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  EMAIL_FROM: z.string().default("FitPulse <no-reply@fitpulse.app>"),
  VAPID_PUBLIC_KEY: z.string().optional().default(""),
  VAPID_PRIVATE_KEY: z.string().optional().default(""),
  VAPID_SUBJECT: z.string().default("mailto:admin@example.com"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === "production",
  corsOrigins: parsed.data.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean),
};
