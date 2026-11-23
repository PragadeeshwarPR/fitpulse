# FitPulse — Product Requirements Document

**Version:** 2.0 · **Product type:** Progressive Web Application · **Category:** Fitness, nutrition & lifestyle tracking · **Design theme:** Premium black & electric green

## 1. Project overview
FitPulse is an AI-powered fitness and lifestyle tracking application. It helps users monitor physical activity, nutrition, calories, sleep, hydration and overall fitness progress. It is a PWA, usable in browsers and installable on supported devices. It provides a personalised dashboard, AI food recognition, activity tracking, nutritional analysis, progress reports and an intelligent fitness assistant. It must be responsive, secure, fast and easy to use.

### 1.1 Main objectives
1. Track daily physical activities. 2. Calculate calories burned. 3. Track daily steps and walking distance where supported. 4. Analyse food photographs using Gemini AI. 5. Calculate daily calorie consumption. 6. Track protein, carbohydrates, fats and fibre. 7. Monitor sleep and hydration. 8. Calculate personalised calorie requirements. 9. Provide AI-powered fitness recommendations. 10. Display daily, weekly and monthly progress.

## 2. Technology stack (must not depend on Firebase)
- **Frontend:** React.js, TypeScript, Vite, Tailwind CSS, responsive components, Recharts.
- **PWA:** web app manifest, service workers, Workbox, IndexedDB for offline data, installable.
- **Backend:** Node.js, Express.js, TypeScript, REST, Prisma ORM.
- **Database:** PostgreSQL; persistent cloud database; proper relationships and indexing.
- **Authentication:** email/password registration; Argon2 or bcrypt hashing; email verification; password reset; secure HTTP-only session cookies.
- **AI:** Google Gemini API: food image recognition, nutrition estimation, fitness assistant, personalised recommendations.
- **Image storage:** Cloudinary or compatible object storage; references in PostgreSQL; no large images in the database.
- **Version control:** Git/GitHub; separate frontend and backend folders in one repository.
- **Deployment:** static frontend hosting; Node.js backend hosting; managed PostgreSQL; environment variables, HTTPS, persistent DB connections.

## 3. Application design
**Palette:** background #080B0A · secondary #101613 · card #151D18 · primary green #39FF78 · secondary green #16C65B · text #FFFFFF · secondary text #A3ADA6 · error #FF5252 · warning #FFC857.
**Requirements:** modern, minimal; rounded dashboard cards; smooth transitions; selective glowing green highlights; clean typography; modern charts and progress indicators; mobile-first; light and dark themes (dark by default). It must look like a premium fitness product.

## 4. User authentication
- **Signup:** full name, email, password, confirm password. Validate email, enforce password security, check for duplicates, send verification, store hashes only.
- **Login:** email and password; secure remembered session; logout; forgot/reset password; account deletion.
- **Onboarding:** date of birth or age, height, weight, biological sex (for the metabolic formula), activity level, fitness goal, target weight, units, diet preference, workout frequency.
  Goals: lose, maintain or gain weight; build muscle; improve endurance; improve general fitness.
  Calculate and store BMI, BMR, TDEE and the recommended daily calorie target. The profile stays editable.

## 5. Main dashboard
- **Daily overview:** calories consumed, burned and remaining; steps; distance; active minutes; water; sleep.
- **Nutrition:** protein, carbs, fat and fibre progress.
- **Activity:** today's activities, total duration, estimated calories burned.
- **Visuals:** circular calorie indicator, daily activity chart, macro bars, step counter, weekly summary. Values update when records change.

## 6. Physical activity tracking
Walking, running, jogging, cycling, swimming, gym, weightlifting, yoga, HIIT, dancing, sports, hiking, custom.
Each record stores name, start time, duration, distance and average pace (when applicable), estimated calories and notes.
Methods: manual entry; GPS walking, running and cycling; browser sensors where available; wearable or health integrations where supported.
**Important:** browsers cannot guarantee continuous background step tracking. The app must communicate these limits, offer manual entry, and never claim accurate all-day step tracking where unsupported.

## 7. AI food scanner
Open scanner → capture or upload → preview → submit. Gemini identifies the food name, ingredients, portion, calories, protein, carbs, fat and fibre (e.g. three idlis with sambar ≈ 350 kcal, 12 g P, 62 g C, 5 g F, 6 g fibre; these are estimates).
Requirements: show an estimated confidence level; allow editing the portion, food name and nutrient values; ask for clarification when uncertain; let the user confirm or reject; save confirmed results to the diary. Never treat an uncertain AI estimate as an exact value.

## 8. Food & nutrition tracking
Meals: breakfast, lunch, dinner, morning snack, evening snack, other. Entry methods: AI scanner, manual, searchable database, recent foods, saved favourites. Track calories, protein, carbs, fat, fibre, sugar and sodium; show daily totals against targets.

## 9. Water tracking
+100 / +250 / +500 ml, custom amount, daily target, progress indicator, history.

## 10. Sleep tracking
Sleep time, wake time, duration, quality, notes; daily summary, weekly chart, average duration, consistency insights. Manual entry is required.

## 11. Body measurements
Weight, target weight, BMI, waist, chest, hip, history; weekly and monthly change; weight trend chart.

## 12. AI fitness assistant
Gemini-powered chat about nutrition, exercise, weight management, muscle building, recovery, habits and general fitness. It uses user-approved profile and progress data. It must not diagnose diseases or replace professional medical advice.

## 13. Analytics & reports
Daily (calories in and out, steps, distance, active minutes, water, sleep), weekly (average steps, average intake, total workout time, average protein, weight change), monthly (weight, activity consistency, nutrition and sleep trends, goal completion). Interactive charts and date filters.

## 14. Achievements & challenges
E.g. first 1,000 steps; 5,000 and 10,000 steps in a day; 7-day workout streak; consistent hydration; 7-day food logging streak. Badges, milestones and history.

## 15. Notifications
Optional water, meal, workout and sleep reminders, daily goals and weekly reports. Users control their preferences. Web push where supported, with graceful fallbacks.

## 16. PWA requirements
Manifest, custom icons, install prompt, service worker, offline shell, responsive UI, fast loading, automatic updates, HTTPS.
**Offline:** open cached screens, view local dashboard data, record meals, workouts and water. Pending changes go to IndexedDB and sync on reconnect, handling duplicates and conflicts safely. AI scanning and authentication require internet.

## 17. Backend & database
Responsibilities: authentication, profiles, food diary, activities, sleep, water, body measurements, AI requests, analytics, notifications, sync.
Tables: users, user_profiles, user_goals, food_entries, food_items, activities, sleep_records, water_records, body_measurements, achievements, notification_preferences, ai_conversations, ai_usage_logs, with foreign keys, indexes, timestamps and strict per-user isolation.

## 18. Repository structure
`frontend/` (public, src/components, pages, layouts, services, hooks, context, utils, styles), `backend/` (src/config, controllers, middleware, routes, services, validators, server.ts; prisma/schema.prisma; tests), `docs/` (PRD, API documentation, database schema), `.gitignore`, `README.md`, `docker-compose.yml`. Never commit API keys, database passwords, secrets or production env files; provide `.env.example`.

## 19. Security
HTTPS; secure hashing; HTTP-only secure cookies; input validation; rate limiting; authentication and authorisation; DB access control; image upload validation; Gemini key on the backend only; user data isolation; account deletion; data export; secure error handling.

## 20. Performance
Mobile-first; optimised images; lazy loading; efficient queries; pagination; caching; fast dashboard; responsive charts; graceful errors.

## 21. Development phases
1 Foundation · 2 UI · 3 Fitness tracking · 4 Nutrition · 5 AI features · 6 Analytics · 7 PWA · 8 Testing & deployment.

## 22. MVP acceptance criteria
1 Register/login · 2 Profiles and goals in PostgreSQL · 3 Calorie targets · 4 Log activities · 5 Calories burned · 6 Record meals · 7 Gemini photo analysis · 8 Correct AI estimates · 9 Daily calories and macros · 10 Water and sleep · 11 Progress views · 12 Installable PWA · 13 Offline logging and sync · 14 Private and secure records · 15 Source in GitHub.

## Final product vision
A complete personal fitness companion combining activity tracking, nutrition analysis, AI recommendations, lifestyle monitoring and progress analytics: reliable, attractive, responsive, secure and scalable.
