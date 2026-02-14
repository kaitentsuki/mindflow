export interface ThoughtImport {
  rawTranscript: string;
  cleanedText?: string;
  summary?: string;
  type?: string;
  priority?: number;
  categories?: string[];
  sentiment?: number;
  entities?: Record<string, string[]>;
  actionItems?: string[];
  deadline?: string;
  language?: string;
  source?: string;
}

const VALID_TYPES = ["task", "idea", "note", "reminder", "journal"];

export function parseJSONImport(content: string): ThoughtImport[] {
  const parsed = JSON.parse(content);
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  return arr.map((item) => ({
    rawTranscript: item.rawTranscript || item.cleanedText || item.text || "",
    cleanedText: item.cleanedText,
    summary: item.summary,
    type: item.type,
    priority: item.priority ? Number(item.priority) : undefined,
    categories: Array.isArray(item.categories) ? item.categories : undefined,
    sentiment: item.sentiment != null ? Number(item.sentiment) : undefined,
    entities: item.entities,
    actionItems: Array.isArray(item.actionItems) ? item.actionItems : undefined,
    deadline: item.deadline,
    language: item.language,
    source: item.source,
  }));
}

export function parseCSVImport(content: string): ThoughtImport[] {
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const results: ThoughtImport[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = values[idx]?.trim() || "";
    });

    results.push({
      rawTranscript: row.rawTranscript || row.cleanedText || row.text || "",
      cleanedText: row.cleanedText || undefined,
      summary: row.summary || undefined,
      type: row.type || undefined,
      priority: row.priority ? Number(row.priority) : undefined,
      categories: row.categories
        ? row.categories.split(";").map((c) => c.trim()).filter(Boolean)
        : undefined,
      sentiment: row.sentiment ? Number(row.sentiment) : undefined,
      entities: row.entities ? tryParseJSON(row.entities) : undefined,
      actionItems: row.actionItems
        ? row.actionItems.split(";").map((a) => a.trim()).filter(Boolean)
        : undefined,
      deadline: row.deadline || undefined,
      language: row.language || undefined,
      source: row.source || undefined,
    });
  }

  return results;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

function tryParseJSON(str: string): Record<string, string[]> | undefined {
  try {
    return JSON.parse(str);
  } catch {
    return undefined;
  }
}

export function validateImportData(
  data: ThoughtImport[]
): { valid: ThoughtImport[]; errors: string[] } {
  const valid: ThoughtImport[] = [];
  const errors: string[] = [];

  data.forEach((item, index) => {
    const rowErrors: string[] = [];

    if (!item.rawTranscript && !item.cleanedText) {
      rowErrors.push(`Row ${index + 1}: Missing text content (rawTranscript or cleanedText)`);
    }

    if (item.type && !VALID_TYPES.includes(item.type)) {
      rowErrors.push(
        `Row ${index + 1}: Invalid type "${item.type}" (must be one of: ${VALID_TYPES.join(", ")})`
      );
    }

    if (item.priority !== undefined && (item.priority < 1 || item.priority > 5)) {
      rowErrors.push(`Row ${index + 1}: Priority must be between 1 and 5`);
    }

    if (item.deadline) {
      const d = new Date(item.deadline);
      if (isNaN(d.getTime())) {
        rowErrors.push(`Row ${index + 1}: Invalid deadline date "${item.deadline}"`);
      }
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
    } else {
      valid.push(item);
    }
  });

  return { valid, errors };
}
