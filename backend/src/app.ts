import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { router } from "./routes/index.js";
import { loadUser } from "./middleware/auth.js";
import { apiLimiter, originCheck } from "./middleware/security.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { UPLOAD_DIR } from "./services/storage.service.js";

export function createApp() {
  const app = express();
  if (env.TRUST_PROXY) app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || env.corsOrigins.includes(origin)),
      credentials: true,
      allowedHeaders: ["content-type", "x-tz-offset"],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      maxAge: 600,
    }),
  );
  if (env.isProd) {
    // Reject plain-HTTP requests that reached us through a proxy.
    app.use((req, res, next) => (req.secure ? next() : res.status(403).json({ error: { code: "https_required", message: "HTTPS required" } })));
  }
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use("/api", apiLimiter, originCheck, loadUser, router);
  // Local image storage fallback (development only; production uses Cloudinary).
  if (!env.isProd) app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d", fallthrough: false }));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
