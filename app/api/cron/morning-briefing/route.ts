import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { prisma } from "@/lib/db";
import { createAndSendNotification } from "@/lib/notifications";

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

export async function POST(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  // Get all users
  const users = await prisma.user.findMany({
    select: { id: true, preferences: true },
  });

  let briefingsGenerated = 0;

  for (const user of users) {
    const prefs = (user.preferences as Record<string, unknown>) || {};
    const notifPrefs = (prefs.notifications as Record<string, unknown>) || {};
    if (notifPrefs.morning_briefing === false) continue;

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    // Gather data
    const [todaysTasks, upcomingDeadlines, yesterdaysCompleted] =
      await Promise.all([
        prisma.thought.findMany({
          where: {
            userId: user.id,
            type: "task",
            status: "active",
          },
          orderBy: { priority: "desc" },
          take: 10,
          select: { summary: true, cleanedText: true, priority: true, deadline: true },
        }),
        prisma.thought.findMany({
          where: {
            userId: user.id,
            deadline: { gte: now, lte: in48h },
            status: "active",
          },
          select: { summary: true, cleanedText: true, deadline: true },
        }),
        prisma.thought.findMany({
          where: {
            userId: user.id,
            status: "done",
            completedAt: { gte: yesterdayStart, lt: todayStart },
          },
          select: { summary: true, cleanedText: true },
        }),
      ]);

    // Skip if no data
    if (todaysTasks.length === 0 && upcomingDeadlines.length === 0 && yesterdaysCompleted.length === 0) {
      continue;
    }

    let briefing: string;

    if (anthropic) {
      const language = (prefs.language as string) || "cs";
      const prompt = `Generate a concise morning briefing for a personal assistant user. Use ${language === "cs" ? "Czech" : "English"} language.

Active tasks (by priority):
${todaysTasks.map((t) => `- [P${t.priority}] ${t.summary || t.cleanedText.slice(0, 80)}${t.deadline ? ` (deadline: ${t.deadline.toISOString().split("T")[0]})` : ""}`).join("\n") || "None"}

Deadlines in next 48h:
${upcomingDeadlines.map((t) => `- ${t.summary || t.cleanedText.slice(0, 80)} (${t.deadline?.toISOString().split("T")[0]})`).join("\n") || "None"}

Completed yesterday:
${yesterdaysCompleted.map((t) => `- ${t.summary || t.cleanedText.slice(0, 80)}`).join("\n") || "None"}

Generate exactly 5 bullet points as a JSON array of strings. Be concise and actionable.`;

      try {
        const response = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 512,
          messages: [{ role: "user", content: prompt }],
        });

        const text =
          response.content[0].type === "text" ? response.content[0].text : "";
        const match = text.match(/\[[\s\S]*\]/);
        if (match) {
          const points = JSON.parse(match[0]);
          briefing = points.map((p: string) => `• ${p}`).join("\n");
        } else {
          briefing = text.trim();
        }
      } catch {
        briefing = formatFallbackBriefing(
          todaysTasks,
          upcomingDeadlines,
          yesterdaysCompleted
        );
      }
    } else {
      briefing = formatFallbackBriefing(
        todaysTasks,
        upcomingDeadlines,
        yesterdaysCompleted
      );
    }

    await createAndSendNotification({
      userId: user.id,
      type: "morning_briefing",
      title: "Good morning! Here's your briefing",
      body: briefing,
      url: "/",
    });
    briefingsGenerated++;
  }

  return NextResponse.json({
    usersProcessed: users.length,
    briefingsGenerated,
    timestamp: new Date().toISOString(),
  });
}

function formatFallbackBriefing(
  tasks: Array<{ summary: string | null; cleanedText: string; priority: number }>,
  deadlines: Array<{ summary: string | null; cleanedText: string }>,
  completed: Array<{ summary: string | null; cleanedText: string }>
): string {
  const lines: string[] = [];
  if (tasks.length > 0) {
    lines.push(`• ${tasks.length} active task${tasks.length > 1 ? "s" : ""} to work on`);
    lines.push(`• Top priority: ${tasks[0].summary || tasks[0].cleanedText.slice(0, 60)}`);
  }
  if (deadlines.length > 0) {
    lines.push(`• ${deadlines.length} deadline${deadlines.length > 1 ? "s" : ""} in the next 48h`);
  }
  if (completed.length > 0) {
    lines.push(`• ${completed.length} task${completed.length > 1 ? "s" : ""} completed yesterday`);
  }
  if (lines.length === 0) {
    lines.push("• No active tasks — enjoy your free day!");
  }
  return lines.join("\n");
}
