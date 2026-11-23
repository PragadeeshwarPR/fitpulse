import { Router } from "express";
import multer from "multer";
import { ah } from "../utils/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { aiLimiter, authLimiter } from "../middleware/security.js";
import * as auth from "../controllers/auth.controller.js";
import * as profile from "../controllers/profile.controller.js";
import * as food from "../controllers/food.controller.js";
import * as activity from "../controllers/activity.controller.js";
import * as wellness from "../controllers/wellness.controller.js";
import * as analytics from "../controllers/analytics.controller.js";
import * as ai from "../controllers/ai.controller.js";
import * as misc from "../controllers/misc.controller.js";
import { sync } from "../controllers/sync.controller.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype)),
});

export const router = Router();

// Called by an external scheduler (Vercel Cron, cron-job.org) because serverless has no timers.
router.get("/cron/reminders", ah(misc.cronReminders));
router.get("/health", (_req, res) => res.json({ ok: true }));

// ---- Auth (public) ----
router.post("/auth/signup", authLimiter, ah(auth.signup));
router.post("/auth/login", authLimiter, ah(auth.login));
router.post("/auth/logout", ah(auth.logout));
router.post("/auth/verify-email", authLimiter, ah(auth.verifyEmail));
router.post("/auth/forgot-password", authLimiter, ah(auth.forgotPassword));
router.post("/auth/reset-password", authLimiter, ah(auth.resetPassword));

// ---- Everything below requires a session ----
const r = Router();
r.use(requireAuth);

r.get("/auth/me", ah(auth.me));
r.post("/auth/resend-verification", authLimiter, ah(auth.resendVerification));
r.post("/auth/change-password", authLimiter, ah(auth.changePassword));
r.get("/account/export", ah(auth.exportData));
r.delete("/account", authLimiter, ah(auth.deleteAccount));

r.get("/profile", ah(profile.getProfile));
r.post("/profile/onboarding", ah(profile.onboard));
r.post("/profile/preview-targets", ah(profile.previewTargets));
r.patch("/profile", ah(profile.updateProfile));

r.get("/food/entries", ah(food.listEntries));
r.post("/food/entries", ah(food.createEntry));
r.patch("/food/entries/:id", ah(food.updateEntry));
r.delete("/food/entries/:id", ah(food.deleteEntry));
r.get("/food/search", ah(food.searchFoods));
r.get("/food/recent", ah(food.recentFoods));
r.get("/food/favorites", ah(food.listFavorites));
r.post("/food/items", ah(food.createFoodItem));
r.delete("/food/items/:id", ah(food.deleteFoodItem));
r.post("/food/scan", aiLimiter, upload.single("image"), ah(food.scanFood));

r.get("/activities", ah(activity.listActivities));
r.get("/activities/estimate", ah(activity.estimateCalories));
r.get("/activities/:id", ah(activity.getActivity));
r.post("/activities", ah(activity.createActivityHandler));
r.patch("/activities/:id", ah(activity.updateActivity));
r.delete("/activities/:id", ah(activity.deleteActivity));
r.get("/steps", ah(activity.getSteps));
r.put("/steps", ah(activity.putSteps));

r.get("/sleep", ah(wellness.listSleep));
r.post("/sleep", ah(wellness.createSleepHandler));
r.put("/sleep/:id", ah(wellness.updateSleep));
r.delete("/sleep/:id", ah(wellness.deleteSleep));
r.get("/water", ah(wellness.listWater));
r.post("/water", ah(wellness.createWaterHandler));
r.delete("/water/:id", ah(wellness.deleteWater));
r.get("/body", ah(wellness.listBody));
r.post("/body", ah(wellness.createBody));
r.delete("/body/:id", ah(wellness.deleteBody));

r.get("/dashboard", ah(analytics.dashboard));
r.get("/analytics", ah(analytics.range));

r.get("/ai/conversations", ah(ai.listConversations));
r.get("/ai/conversations/:id", ah(ai.getConversation));
r.delete("/ai/conversations/:id", ah(ai.deleteConversation));
r.post("/ai/chat", aiLimiter, ah(ai.sendMessage));
r.get("/ai/insight", aiLimiter, ah(ai.insight));

r.get("/achievements", ah(misc.listAchievements));
r.get("/notifications/preferences", ah(misc.getPrefs));
r.put("/notifications/preferences", ah(misc.updatePrefs));
r.post("/notifications/subscribe", ah(misc.subscribePush));
r.post("/notifications/unsubscribe", ah(misc.unsubscribePush));
r.post("/notifications/test", ah(misc.testPush));

r.post("/sync", ah(sync));

router.use(r);
