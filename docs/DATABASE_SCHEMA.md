# FitPulse database schema

PostgreSQL via Prisma. The source of truth is [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma), and migrations live in `backend/prisma/migrations/`.

## Design rules
- **User isolation:** every personal table has `userId → users.id ON DELETE CASCADE`. Every query filters by the session's `userId`, and updates and deletes use `WHERE id = ? AND userId = ?`, so another user's records return 404.
- **Account deletion** removes the user row; cascades remove all personal data. Images are deleted from storage first.
- **Indexes:** `(userId, <timestamp>)` on every time-series table for per-day and range queries.
- **Offline idempotency:** `food_entries`, `activities`, `sleep_records` and `water_records` have `UNIQUE (userId, clientId)`.
- **Soft delete** (`deletedAt`) on offline-syncable tables, so a delete can sync without resurrecting the record.
- **Timestamps:** `createdAt` and `updatedAt` on all mutable tables. `updatedAt` drives sync conflict detection.
- **Secrets:** passwords are stored as Argon2id hashes. Session and email/reset tokens are stored as SHA-256 hashes, never raw.

## Tables
| Table | Purpose | Key columns |
|---|---|---|
| `users` | Accounts | `email` UNIQUE, `passwordHash`, `emailVerifiedAt` |
| `sessions` | Server-side sessions | `tokenHash` UNIQUE, `expiresAt` (idx), `userId` (idx) |
| `auth_tokens` | Email verification / password reset | `type`, `tokenHash` UNIQUE, `expiresAt`, `usedAt` |
| `user_profiles` | Onboarding data (1:1) | `dateOfBirth`, `sex`, `heightCm`, `weightKg`, `activityLevel`, `unitSystem`, `dietPreference`, `workoutsPerWeek`, `aiPersonalization` |
| `user_goals` | Goal and computed targets (1:1) | `goal`, `targetWeightKg`, `bmi`, `bmr`, `tdee`, `dailyCalorieTarget`, macro/fibre/water/step/sleep targets |
| `food_items` | Food database (`userId NULL` = global) plus user favourites | nutrients per serving, `isFavorite`; idx `name`, `userId` |
| `food_entries` | Diary | `mealType`, nutrients, `servings`, `source` (manual/ai_scan/database/recent/favorite), `aiConfidence`, `aiRaw` JSON, `imageUrl`, `eatenAt` |
| `activities` | Workouts | `type`, `startTime`, `durationMin`, `distanceKm`, `avgPaceMinKm`, `steps`, `caloriesBurned`, `source` (manual/gps/sensor/integration), `route` JSON |
| `step_records` | Daily step totals | UNIQUE `(userId, date)` |
| `sleep_records` | Sleep | `sleepStart`, `sleepEnd`, `durationMin`, `quality` 1-5 |
| `water_records` | Hydration | `amountMl`, `recordedAt` |
| `body_measurements` | Weight and circumferences | `weightKg`, `bmi`, `waistCm`, `chestCm`, `hipCm` |
| `achievements` | Unlocked badges | UNIQUE `(userId, code)`; definitions live in code |
| `notification_preferences` | Reminder settings (1:1) | toggles, times, `timezone`, quiet hours |
| `push_subscriptions` | Web Push endpoints | `endpoint` UNIQUE |
| `ai_conversations` / `ai_messages` | Coach chat history | `role` user/model |
| `ai_usage_logs` | AI metering and auditing | `feature`, `model`, tokens, `success`, `latencyMs`; drives the daily quota |

## Daily aggregation
Dashboard and analytics totals are computed on read (`services/analytics.service.ts`) from a few indexed range queries per period, grouped by the user's local day. Sleep counts toward the day you wake up. Step totals are reconciled with on-foot activities so walking steps aren't double-counted.
