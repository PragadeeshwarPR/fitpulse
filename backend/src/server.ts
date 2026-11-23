import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { createApp } from "./app.js";
import { runReminderTick } from "./services/push.service.js";
import { purgeExpiredSessions } from "./services/session.service.js";

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.info(`FitPulse API listening on :${env.PORT} (${env.NODE_ENV})`);
});

// Background jobs: reminders every minute, session cleanup hourly.
const reminders = setInterval(() => runReminderTick().catch((e) => console.error("reminder tick", e)), 60_000);
const cleanup = setInterval(() => purgeExpiredSessions().catch(() => undefined), 3_600_000);

async function shutdown() {
  clearInterval(reminders);
  clearInterval(cleanup);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
