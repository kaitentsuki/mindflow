import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./db";

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

interface InsightData {
  totalThoughts: number;
  typeDistribution: Record<string, number>;
  taskCompletionRate: number;
  avgSentiment: number | null;
  sentimentTrend: "improving" | "declining" | "stable" | "insufficient_data";
  topCategories: Array<{ category: string; count: number }>;
  recurringEntities: Array<{ name: string; count: number; type: string }>;
  unfinishedHighPriority: number;
  recentDays: number;
}

/**
 * Gather insight data for a user over the given number of days.
 */
export async function gatherInsightData(
  userId: string,
  days: number = 30
): Promise<InsightData> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const thoughts = await prisma.thought.findMany({
    where: { userId, createdAt: { gte: since } },
    select: {
      type: true,
      priority: true,
      categories: true,
      sentiment: true,
      entities: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Type distribution
  const typeDistribution: Record<string, number> = {};
  for (const t of thoughts) {
    typeDistribution[t.type] = (typeDistribution[t.type] || 0) + 1;
  }

  // Task completion rate
  const tasks = thoughts.filter((t) => t.type === "task");
  const completedTasks = tasks.filter((t) => t.status === "done");
  const taskCompletionRate =
    tasks.length > 0 ? completedTasks.length / tasks.length : 0;

  // Average sentiment
  const sentiments = thoughts
    .map((t) => t.sentiment)
    .filter((s): s is number => s !== null);
  const avgSentiment =
    sentiments.length > 0
      ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length
      : null;

  // Sentiment trend (compare first half vs second half)
  let sentimentTrend: InsightData["sentimentTrend"] = "insufficient_data";
  if (sentiments.length >= 6) {
    const mid = Math.floor(sentiments.length / 2);
    const firstHalf = sentiments.slice(0, mid);
    const secondHalf = sentiments.slice(mid);
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const diff = secondAvg - firstAvg;
    if (diff > 0.1) sentimentTrend = "improving";
    else if (diff < -0.1) sentimentTrend = "declining";
    else sentimentTrend = "stable";
  }

  // Top categories
  const catCounts: Record<string, number> = {};
  for (const t of thoughts) {
    for (const cat of t.categories) {
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    }
  }
  const topCategories = Object.entries(catCounts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Recurring entities
  const entityCounts: Record<string, { count: number; type: string }> = {};
  for (const t of thoughts) {
    const entities = t.entities as Record<string, string[]> | null;
    if (!entities) continue;
    for (const [entityType, names] of Object.entries(entities)) {
      if (!Array.isArray(names)) continue;
      for (const name of names) {
        const key = `${entityType}:${name}`;
        if (!entityCounts[key]) entityCounts[key] = { count: 0, type: entityType };
        entityCounts[key].count++;
      }
    }
  }
  const recurringEntities = Object.entries(entityCounts)
    .filter(([, v]) => v.count >= 2)
    .map(([key, v]) => ({ name: key.split(":")[1], count: v.count, type: v.type }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Unfinished high-priority tasks
  const unfinishedHighPriority = await prisma.thought.count({
    where: {
      userId,
      type: "task",
      priority: { gte: 4 },
      status: "active",
    },
  });

  return {
    totalThoughts: thoughts.length,
    typeDistribution,
    taskCompletionRate,
    avgSentiment,
    sentimentTrend,
    topCategories,
    recurringEntities,
    unfinishedHighPriority,
    recentDays: days,
  };
}

/**
 * Generate human-readable insights using Haiku.
 * Returns 2-3 actionable bullet points.
 */
export async function generateInsights(
  userId: string
): Promise<string[]> {
  const data = await gatherInsightData(userId, 30);

  if (data.totalThoughts < 10) {
    return [
      "Keep recording your thoughts! You need at least 10 entries for meaningful insights.",
    ];
  }

  if (!anthropic) {
    return formatFallbackInsights(data);
  }

  const prompt = `You are an AI personal assistant analyzing a user's thought journal data from the last ${data.recentDays} days.

Data:
- Total thoughts: ${data.totalThoughts}
- Type breakdown: ${JSON.stringify(data.typeDistribution)}
- Task completion rate: ${(data.taskCompletionRate * 100).toFixed(0)}%
- Average sentiment: ${data.avgSentiment?.toFixed(2) ?? "N/A"}
- Sentiment trend: ${data.sentimentTrend}
- Top categories: ${data.topCategories.map((c) => `${c.category} (${c.count})`).join(", ") || "none"}
- Recurring entities: ${data.recurringEntities.map((e) => `${e.name} [${e.type}] (${e.count}×)`).join(", ") || "none"}
- Unfinished high-priority tasks: ${data.unfinishedHighPriority}

Generate exactly 3 short, actionable insights as a JSON array of strings. Be specific and reference the data. Keep each insight to 1 sentence.`;

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
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) return parsed.map(String).slice(0, 3);
    }
  } catch {
    // Fall through to fallback
  }

  return formatFallbackInsights(data);
}

function formatFallbackInsights(data: InsightData): string[] {
  const insights: string[] = [];

  if (data.taskCompletionRate < 0.5 && data.typeDistribution.task > 0) {
    insights.push(
      `Your task completion rate is ${(data.taskCompletionRate * 100).toFixed(0)}% — consider breaking large tasks into smaller steps.`
    );
  }

  if (data.unfinishedHighPriority > 0) {
    insights.push(
      `You have ${data.unfinishedHighPriority} unfinished high-priority task${data.unfinishedHighPriority > 1 ? "s" : ""} — review and prioritize these first.`
    );
  }

  if (data.topCategories.length > 0) {
    insights.push(
      `Your most active area is "${data.topCategories[0].category}" with ${data.topCategories[0].count} entries.`
    );
  }

  if (insights.length === 0) {
    insights.push(
      `You've recorded ${data.totalThoughts} thoughts in the last ${data.recentDays} days — keep it up!`
    );
  }

  return insights.slice(0, 3);
}
