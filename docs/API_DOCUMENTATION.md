# FitPulse API

Base path: `/api`. JSON in, JSON out. Authentication uses an **HTTP-only session cookie** (`fp_session`) set by signup/login.

**Conventions**
- Send `x-tz-offset: <Date#getTimezoneOffset()>` so "today" and daily totals use the user's local day.
- State-changing requests must come from an allowed `Origin` (CSRF protection).
- Errors: `{ "error": { "code": string, "message": string, "details"?: { fieldErrors, formErrors } } }`.
- Dates: ISO-8601 instants; `date` query params are local calendar dates `YYYY-MM-DD`.
- Rate limits: 300 req/min/IP globally; 20 auth attempts/15 min; 10 AI calls/min/user plus `AI_DAILY_LIMIT` per day.
- Offline-capable records (`food`, `activity`, `water`, `sleep`) accept an optional `clientId`. A create with an existing `clientId` returns the existing record (idempotent).

## Auth & account
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/signup` | `{fullName, email, password, confirmPassword}` | 201, sets cookie, sends verification email. 409 if email exists. Password: 8+ chars, upper, lower, digit, symbol. |
| POST | `/auth/login` | `{email, password}` | Returns `{user, onboarded}` |
| POST | `/auth/logout` | – | 204 |
| GET | `/auth/me` | – | `{user, onboarded}` |
| POST | `/auth/verify-email` | `{token}` | Single use, 48 h |
| POST | `/auth/resend-verification` | – | auth |
| POST | `/auth/forgot-password` | `{email}` | Always 200 (no account enumeration) |
| POST | `/auth/reset-password` | `{token, password, confirmPassword}` | Single use, 1 h; revokes all sessions |
| POST | `/auth/change-password` | `{currentPassword, newPassword}` | Revokes other sessions |
| GET | `/account/export` | – | Full JSON export (download) |
| DELETE | `/account` | `{password, confirm: "DELETE"}` | Deletes the user, all data, and images |

## Profile & targets
| Method | Path | Notes |
|---|---|---|
| GET | `/profile` | `{profile, goals, bmiCategory}` |
| POST | `/profile/onboarding` | `{dateOfBirth, sex, heightCm, weightKg, activityLevel, goal, targetWeightKg, unitSystem, dietPreference, workoutsPerWeek, aiPersonalization}`; computes BMI, BMR (Mifflin-St Jeor), TDEE, calorie & macro targets |
| POST | `/profile/preview-targets` | Same body; returns targets without saving |
| PATCH | `/profile` | Any onboarding field plus `fullName, waterTargetMl, stepTarget, sleepTargetMin, dailyCalorieTarget`. Body metrics changes recompute targets. |

## Food
| Method | Path | Notes |
|---|---|---|
| GET | `/food/entries?date=` | Diary for a local day |
| POST | `/food/entries` | `{clientId?, mealType, name, servings, portionDesc?, calories, proteinG, carbsG, fatG, fiberG, sugarG, sodiumMg, source, aiConfidence?, aiRaw?, imageUrl?, eatenAt}` |
| PATCH / DELETE | `/food/entries/:id` | Soft delete |
| GET | `/food/search?q=` | Global food database plus the user's own items |
| GET | `/food/recent` | Distinct recently logged foods |
| GET | `/food/favorites` · POST `/food/items` · DELETE `/food/items/:id` | Favourite meals |
| POST | `/food/scan` | `multipart/form-data`: `image` (JPEG/PNG/WebP, ≤ 8 MB, checked by magic bytes), optional `hint`. Returns `{analysis, imageUrl}`; **does not save**. The client saves the confirmed or edited result via `POST /food/entries`. |

`analysis`: `{isFood, foodName, items[], ingredients[], portionDescription, totals{calories, proteinG, carbsG, fatG, fiberG, sugarG, sodiumMg}, confidence (0-1), needsClarification, clarificationQuestion, notes}`. Results with confidence below 0.6 always set `needsClarification`.

## Activity & steps
| Method | Path | Notes |
|---|---|---|
| GET | `/activities?date=` or `?page=&pageSize=` | Paginated history |
| GET | `/activities/:id` | Includes the GPS `route` |
| POST | `/activities` | `{clientId?, type, name?, startTime, durationMin, distanceKm?, steps?, caloriesBurned?, source, route?, notes?}`. Calories are estimated (MET × kg × h, speed-adjusted) unless provided. |
| PATCH / DELETE | `/activities/:id` | |
| GET | `/activities/estimate?type=&durationMin=&distanceKm=` | Calorie estimate preview |
| GET / PUT | `/steps?date=` · `{date, steps, source}` | Daily step total. `sensor` source never lowers an existing count. |

Activity types: walking, running, jogging, cycling, swimming, gym, weightlifting, yoga, hiit, dancing, sports, hiking, other.

## Sleep, water, body
| Method | Path | Notes |
|---|---|---|
| GET/POST | `/sleep` · `/sleep/:id` (PUT, DELETE) | `{clientId?, sleepStart, sleepEnd, quality 1-5, notes?}`; at most 20 h |
| GET/POST | `/water?date=` · DELETE `/water/:id` | `{clientId?, amountMl 10-5000, recordedAt}` |
| GET/POST | `/body` · DELETE `/body/:id` | `{measuredAt, weightKg?, waistCm?, chestCm?, hipCm?, notes?}`; BMI is computed; the latest weight updates the profile |

## Analytics
| Method | Path | Notes |
|---|---|---|
| GET | `/dashboard?date=` | Today's summary, goals, remaining calories, activities, last 7 days plus summary |
| GET | `/analytics?from=&to=` | Daily series (max 366 days), summary averages, goal-completion counts, weigh-ins |

## AI
| Method | Path | Notes |
|---|---|---|
| POST | `/ai/chat` | `{conversationId?, message}` → `{conversationId, message}` |
| GET | `/ai/conversations` · `/ai/conversations/:id` · DELETE | History |
| GET | `/ai/insight` | One short daily insight (needs personalisation consent) |

## Achievements & notifications
| Method | Path | Notes |
|---|---|---|
| GET | `/achievements` | All badges with unlocked state |
| GET/PUT | `/notifications/preferences` | Reminder settings, timezone, quiet hours |
| POST | `/notifications/subscribe` · `/unsubscribe` · `/test` | Web Push subscription (VAPID) |

## Offline sync
`POST /sync` with `{ ops: [{ opId, entity: food|activity|water|sleep, action: create|update|delete, clientId, baseUpdatedAt?, data? }] }` (≤ 200 ops).
Ops are applied in order. Response: `{ results: [{opId, status: ok|conflict|error, serverId?, message?, server?}], unlocked, serverTime }`.
- **create**: idempotent on `clientId`, so replaying a batch never duplicates records.
- **delete**: soft delete; a no-op if the record is already gone.
- **update**: rejected as a `conflict` if the server copy changed after `baseUpdatedAt`; the server version wins.
