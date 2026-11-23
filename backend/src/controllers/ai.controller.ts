import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { uid } from "../middleware/auth.js";
import { parse } from "../middleware/validate.js";
import { chat, dailyInsight } from "../services/gemini.service.js";
import { dailySeries, summarize } from "../services/analytics.service.js";
import { ageFromDob } from "../services/metrics.service.js";
import { addDays, localMidnightUtc } from "../utils/dates.js";
import { notFound } from "../utils/errors.js";

/** Builds a compact, consented summary of profile and recent progress for the AI. */
async function buildUserContext(userId: string, tz: number): Promise<string | null> {
  const [user, profile, goals] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } }),
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.userGoal.findUnique({ where: { userId } }),
  ]);
  if (!profile || !goals || !profile.aiPersonalization) return null;
  const week = await dailySeries(userId, addDays(localMidnightUtc(new Date(), tz), -6), 7, tz);
  const s = summarize(week);
  const today = week.at(-1)!;
  return [
    `First name: ${user?.fullName.split(" ")[0]}`,
    `Age ${ageFromDob(profile.dateOfBirth)}, ${profile.sex}, ${profile.heightCm} cm, ${profile.weightKg} kg (BMI ${goals.bmi}); target weight ${goals.targetWeightKg} kg`,
    `Goal: ${goals.goal.replace(/_/g, " ")}; activity level ${profile.activityLevel.replace("_", " ")}; ${profile.workoutsPerWeek} workouts/week; diet: ${profile.dietPreference}`,
    `Daily targets: ${goals.dailyCalorieTarget} kcal, protein ${goals.proteinTargetG} g, carbs ${goals.carbsTargetG} g, fat ${goals.fatTargetG} g, water ${goals.waterTargetMl} ml, ${goals.stepTarget} steps; TDEE ${goals.tdee}`,
    `Today so far: ${today.caloriesIn} kcal eaten, ${today.proteinG} g protein, ${today.caloriesOut} kcal burned, ${today.steps} steps, ${today.waterMl} ml water, slept ${Math.round(today.sleepMin / 6) / 10} h`,
    `Last 7 days: avg ${s.avgSteps} steps/day, avg intake ${s.avgCaloriesIn} kcal on ${s.foodLoggedDays} logged days, avg protein ${s.avgProteinG} g, ${s.totalWorkouts} workouts (${s.totalActiveMin} active min), avg sleep ${Math.round(s.avgSleepMin / 6) / 10} h, weight change ${s.weightChangeKg ?? "n/a"} kg`,
  ].join("\n");
}

export async function listConversations(req: Request, res: Response) {
  res.json({
    items: await prisma.aiConversation.findMany({
      where: { userId: uid(req) },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, title: true, updatedAt: true },
    }),
  });
}

export async function getConversation(req: Request, res: Response) {
  const c = await prisma.aiConversation.findFirst({
    where: { id: req.params.id, userId: uid(req) },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!c) throw notFound();
  res.json({ conversation: c });
}

export async function deleteConversation(req: Request, res: Response) {
  const r = await prisma.aiConversation.deleteMany({ where: { id: req.params.id, userId: uid(req) } });
  if (!r.count) throw notFound();
  res.status(204).end();
}

const messageSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(2000),
});

export async function sendMessage(req: Request, res: Response) {
  const userId = uid(req);
  const d = parse(messageSchema, req.body);
  let conversation = d.conversationId
    ? await prisma.aiConversation.findFirst({ where: { id: d.conversationId, userId } })
    : null;
  if (d.conversationId && !conversation) throw notFound("Conversation not found");
  if (!conversation) {
    conversation = await prisma.aiConversation.create({ data: { userId, title: d.message.slice(0, 60) } });
  }
  const history = await prisma.aiMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const contents = [
    ...history.reverse().map((m) => ({ role: m.role as "user" | "model", parts: [{ text: m.content }] })),
    { role: "user" as const, parts: [{ text: d.message }] },
  ];
  const reply = await chat(userId, contents, await buildUserContext(userId, req.tz));
  const [, modelMsg] = await prisma.$transaction([
    prisma.aiMessage.create({ data: { conversationId: conversation.id, role: "user", content: d.message } }),
    prisma.aiMessage.create({ data: { conversationId: conversation.id, role: "model", content: reply } }),
    prisma.aiConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } }),
  ]);
  res.json({ conversationId: conversation.id, message: modelMsg });
}

export async function insight(req: Request, res: Response) {
  const ctx = await buildUserContext(uid(req), req.tz);
  if (!ctx) return res.json({ insight: null });
  res.json({ insight: await dailyInsight(uid(req), ctx) });
}
