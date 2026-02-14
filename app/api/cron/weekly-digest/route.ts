import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { prisma } from "@/lib/db";
import { createAndSendNotification } from "@/lib/notifications";
import { gatherInsightData } from "@/lib/insights";

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

export async function POST(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const users = await prisma.user.findMany({
    select: { id: true, preferences: true },
  });

  let digestsGenerated = 0;

  for (const user of users) {
    const prefs = (user.preferences as Record<string, unknown>) || {};
    const notifPrefs = (prefs.notifications as Record<string, unknown>) || {};
    if (notifPrefs.weekly_digest === false) continue;

    const data = await gatherInsightData(user.id, 7);

    if (data.totalThoughts === 0) continue;

    let digest: string;

    if (anthropic) {
      const language = (prefs.language as string) || "cs";
      const prompt = `Generate a weekly digest for a personal assistant user. Use ${language === "cs" ? "Czech" : "English"} language.

This week's data:
- Total thoughts: ${data.totalThoughts}
- Type breakdown: ${JSON.stringify(data.typeDistribution)}
- Task completion rate: ${(data.taskCompletionRate * 100).toFixed(0)}%
- Average sentiment: ${data.avgSentiment?.toFixed(2) ?? "N/A"}
- Sentiment trend: ${data.sentimentTrend}
- Top categories: ${data.topCategories.map((c) => `${c.category} (${c.count})`).join(", ") || "none"}
- Recurring entities: ${data.recurringEntities.map((e) => `${e.name} (${e.count}×)`).join(", ") || "none"}
- Unfinished high-priority tasks: ${data.unfinishedHighPriority}

Generate a digest with these sections as a JSON object:
{
  "summary": "1-2 sentence week overview",
  "accomplishments": ["list of key accomplishments"],
  "attention": ["items needing attention"],
  "insight": "one key insight or recommendation"
}`;

      try {
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        });

        const text =
          response.content[0].type === "text" ? response.content[0].text : "";
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          const lines: string[] = [];
          lines.push(parsed.summary || "");
          if (parsed.accomplishments?.length) {
            lines.push("\nAccomplishments:");
            for (const a of parsed.accomplishments) lines.push(`• ${a}`);
          }
          if (parsed.attention?.length) {
            lines.push("\nNeeds attention:");
            for (const a of parsed.attention) lines.push(`• ${a}`);
          }
          if (parsed.insight) {
            lines.push(`\nInsight: ${parsed.insight}`);
          }
          digest = lines.join("\n");
        } else {
          digest = text.trim();
        }
      } catch {
        digest = formatFallbackDigest(data);
      }
    } else {
      digest = formatFallbackDigest(data);
    }

    await createAndSendNotification({
      userId: user.id,
      type: "weekly_digest",
      title: "Your weekly digest",
      body: digest,
      url: "/",
    });
    digestsGenerated++;
  }

  return NextResponse.json({
    usersProcessed: users.length,
    digestsGenerated,
    timestamp: new Date().toISOString(),
  });
}

function formatFallbackDigest(data: ReturnType<typeof Object>): string {
  const d = data as {
    totalThoughts: number;
    taskCompletionRate: number;
    unfinishedHighPriority: number;
    topCategories: Array<{ category: string; count: number }>;
  };
  const lines: string[] = [];
  lines.push(`This week: ${d.totalThoughts} thoughts recorded.`);
  lines.push(
    `Task completion rate: ${(d.taskCompletionRate * 100).toFixed(0)}%`
  );
  if (d.unfinishedHighPriority > 0) {
    lines.push(
      `${d.unfinishedHighPriority} high-priority task${d.unfinishedHighPriority > 1 ? "s" : ""} need${d.unfinishedHighPriority === 1 ? "s" : ""} attention.`
    );
  }
  if (d.topCategories.length > 0) {
    lines.push(
      `Most active: ${d.topCategories.map((c: { category: string; count: number }) => c.category).join(", ")}`
    );
  }
  return lines.join("\n");
}
