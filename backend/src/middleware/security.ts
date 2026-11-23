import type { NextFunction, Request, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { env } from "../config/env.js";
import { forbidden } from "../utils/errors.js";

/**
 * CSRF defence for cookie-authenticated, state-changing requests: the Origin
 * (or Referer) header must match an allowed frontend origin.
 */
export function originCheck(req: Request, _res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.header("origin") ?? (req.header("referer") ? new URL(req.header("referer")!).origin : undefined);
  if (!origin) {
    // Non-browser clients (curl, tests) send no Origin; allowed outside production.
    return env.isProd ? next(forbidden("Missing origin")) : next();
  }
  if (!env.corsOrigins.includes(origin)) return next(forbidden("Origin not allowed"));
  next();
}

const json = (message: string) => ({ error: { code: "rate_limited", message } });

export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: json("Too many requests, slow down."),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: env.NODE_ENV === "test" ? 1000 : 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: json("Too many authentication attempts. Try again later."),
});

export const aiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip ?? ""),
  message: json("AI rate limit reached. Wait a minute and retry."),
});
