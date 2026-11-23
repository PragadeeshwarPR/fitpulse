import type { NextFunction, Request, Response } from "express";
import type { User } from "@prisma/client";
import { SESSION_COOKIE, findSessionUser } from "../services/session.service.js";
import { unauthorized } from "../utils/errors.js";
import { parseTzOffset } from "../utils/dates.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
      tz: number;
    }
  }
}

export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  req.tz = parseTzOffset(req.header("x-tz-offset"));
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) {
    try {
      req.user = (await findSessionUser(token)) ?? undefined;
    } catch (e) {
      return next(e);
    }
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  next();
}

/** Narrow helper for controllers behind requireAuth. */
export const uid = (req: Request) => req.user!.id;
