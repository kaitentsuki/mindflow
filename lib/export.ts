export interface ThoughtExport {
  id: string;
  type: string;
  priority: number;
  summary: string | null;
  cleanedText: string;
  rawTranscript: string;
  status: string;
  categories: string[];
  sentiment: number | null;
  entities: Record<string, string[]>;
  actionItems: string[];
  deadline: string | null;
  language: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export function thoughtsToJSON(thoughts: ThoughtExport[]): string {
  return JSON.stringify(thoughts, null, 2);
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function thoughtsToCSV(thoughts: ThoughtExport[]): string {
  const headers = [
    "id",
    "type",
    "priority",
    "summary",
    "cleanedText",
    "rawTranscript",
    "status",
    "categories",
    "sentiment",
    "entities",
    "actionItems",
    "deadline",
    "language",
    "source",
    "createdAt",
    "updatedAt",
  ];

  const rows = thoughts.map((t) =>
    [
      escapeCSV(t.id),
      escapeCSV(t.type),
      String(t.priority),
      escapeCSV(t.summary || ""),
      escapeCSV(t.cleanedText),
      escapeCSV(t.rawTranscript),
      escapeCSV(t.status),
      escapeCSV(t.categories.join("; ")),
      t.sentiment !== null ? String(t.sentiment) : "",
      escapeCSV(JSON.stringify(t.entities)),
      escapeCSV(t.actionItems.join("; ")),
      t.deadline || "",
      escapeCSV(t.language),
      escapeCSV(t.source),
      escapeCSV(t.createdAt),
      escapeCSV(t.updatedAt),
    ].join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

export function thoughtsToMarkdown(thoughts: ThoughtExport[]): string {
  const lines: string[] = ["# MindFlow Export", ""];

  for (const t of thoughts) {
    lines.push(`## ${t.summary || t.cleanedText}`);
    lines.push("");
    lines.push(`- **Type:** ${t.type}`);
    lines.push(`- **Priority:** ${t.priority}/5`);
    lines.push(`- **Status:** ${t.status}`);
    if (t.categories.length > 0) {
      lines.push(`- **Categories:** ${t.categories.join(", ")}`);
    }
    if (t.deadline) {
      lines.push(`- **Deadline:** ${t.deadline}`);
    }
    if (t.sentiment !== null) {
      lines.push(`- **Sentiment:** ${t.sentiment}`);
    }
    lines.push(`- **Language:** ${t.language}`);
    lines.push(`- **Source:** ${t.source}`);
    lines.push(`- **Created:** ${t.createdAt}`);
    lines.push("");

    if (t.cleanedText !== t.rawTranscript) {
      lines.push("### Transcript");
      lines.push("");
      lines.push(`> ${t.rawTranscript}`);
      lines.push("");
    }

    if (t.actionItems.length > 0) {
      lines.push("### Action Items");
      lines.push("");
      for (const item of t.actionItems) {
        lines.push(`- [ ] ${item}`);
      }
      lines.push("");
    }

    const entities = t.entities || {};
    const hasEntities = Object.values(entities).some(
      (arr) => Array.isArray(arr) && arr.length > 0
    );
    if (hasEntities) {
      lines.push("### Entities");
      lines.push("");
      for (const [key, values] of Object.entries(entities)) {
        if (Array.isArray(values) && values.length > 0) {
          lines.push(`- **${key}:** ${values.join(", ")}`);
        }
      }
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}
