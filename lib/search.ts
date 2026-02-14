import { prisma } from "./db";
import { generateEmbedding } from "./embeddings";

export interface SearchOptions {
  userId: string;
  query: string;
  type?: string;
  priority?: number;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  limit?: number;
}

export interface SearchResult {
  id: string;
  summary: string | null;
  cleanedText: string;
  type: string;
  priority: number;
  categories: string[];
  status: string;
  deadline: string | null;
  createdAt: string;
  score: number;
  semanticRank?: number;
  textRank?: number;
}

interface RawSearchRow {
  id: string;
  summary: string | null;
  cleaned_text: string;
  type: string;
  priority: number;
  categories: string[];
  status: string;
  deadline: Date | null;
  created_at: Date;
  similarity?: number;
  rank?: number;
}

function buildFilterClauses(
  options: SearchOptions,
  paramOffset: number
): { clauses: string[]; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (options.type) {
    clauses.push(`type = $${paramOffset + params.length + 1}`);
    params.push(options.type);
  }
  if (options.priority !== undefined) {
    clauses.push(`priority = $${paramOffset + params.length + 1}`);
    params.push(options.priority);
  }
  if (options.category) {
    clauses.push(`$${paramOffset + params.length + 1} = ANY(categories)`);
    params.push(options.category);
  }
  if (options.dateFrom) {
    clauses.push(
      `created_at >= $${paramOffset + params.length + 1}::timestamptz`
    );
    params.push(options.dateFrom);
  }
  if (options.dateTo) {
    clauses.push(
      `created_at <= $${paramOffset + params.length + 1}::timestamptz`
    );
    params.push(options.dateTo);
  }
  if (options.status) {
    clauses.push(`status = $${paramOffset + params.length + 1}`);
    params.push(options.status);
  }

  return { clauses, params };
}

export async function semanticSearch(
  userId: string,
  queryEmbedding: number[],
  limit: number,
  filters?: Omit<SearchOptions, "userId" | "query" | "limit">
): Promise<RawSearchRow[]> {
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  let whereClauses = [
    `user_id = $2::uuid`,
    `embedding IS NOT NULL`,
    `status != 'archived'`,
  ];
  const params: unknown[] = [vectorStr, userId];

  if (filters) {
    const { clauses, params: filterParams } = buildFilterClauses(
      { userId, query: "", ...filters },
      params.length
    );
    whereClauses = whereClauses.concat(clauses);
    params.push(...filterParams);
  }

  params.push(limit);
  const limitParam = `$${params.length}`;

  const sql = `
    SELECT id, summary, cleaned_text, type, priority, categories, status, deadline, created_at,
           1 - (embedding <=> $1::vector) AS similarity
    FROM thoughts
    WHERE ${whereClauses.join(" AND ")}
    ORDER BY embedding <=> $1::vector
    LIMIT ${limitParam}
  `;

  return prisma.$queryRawUnsafe<RawSearchRow[]>(sql, ...params);
}

export async function fullTextSearch(
  userId: string,
  query: string,
  limit: number,
  filters?: Omit<SearchOptions, "userId" | "query" | "limit">
): Promise<RawSearchRow[]> {
  let whereClauses = [
    `user_id = $2::uuid`,
    `search_vector @@ plainto_tsquery('simple', $1)`,
    `status != 'archived'`,
  ];
  const params: unknown[] = [query, userId];

  if (filters) {
    const { clauses, params: filterParams } = buildFilterClauses(
      { userId, query: "", ...filters },
      params.length
    );
    whereClauses = whereClauses.concat(clauses);
    params.push(...filterParams);
  }

  params.push(limit);
  const limitParam = `$${params.length}`;

  const sql = `
    SELECT id, summary, cleaned_text, type, priority, categories, status, deadline, created_at,
           ts_rank(search_vector, plainto_tsquery('simple', $1)) AS rank
    FROM thoughts
    WHERE ${whereClauses.join(" AND ")}
    ORDER BY rank DESC
    LIMIT ${limitParam}
  `;

  return prisma.$queryRawUnsafe<RawSearchRow[]>(sql, ...params);
}

export async function hybridSearch(
  options: SearchOptions
): Promise<SearchResult[]> {
  const limit = options.limit || 20;
  const filters = {
    type: options.type,
    priority: options.priority,
    category: options.category,
    dateFrom: options.dateFrom,
    dateTo: options.dateTo,
    status: options.status,
  };

  const embedding = await generateEmbedding(options.query);

  let semanticResults: RawSearchRow[] = [];
  let textResults: RawSearchRow[] = [];

  if (embedding) {
    [semanticResults, textResults] = await Promise.all([
      semanticSearch(options.userId, embedding, limit, filters),
      fullTextSearch(options.userId, options.query, limit, filters),
    ]);
  } else {
    // Fallback to full-text search only
    textResults = await fullTextSearch(
      options.userId,
      options.query,
      limit,
      filters
    );
  }

  // Reciprocal Rank Fusion (RRF)
  const K = 60;
  const scoreMap = new Map<
    string,
    { row: RawSearchRow; score: number; semanticRank?: number; textRank?: number }
  >();

  semanticResults.forEach((row, index) => {
    const rank = index + 1;
    const entry = scoreMap.get(row.id) || {
      row,
      score: 0,
    };
    entry.score += 1 / (K + rank);
    entry.semanticRank = rank;
    scoreMap.set(row.id, entry);
  });

  textResults.forEach((row, index) => {
    const rank = index + 1;
    const entry = scoreMap.get(row.id) || {
      row,
      score: 0,
    };
    entry.score += 1 / (K + rank);
    entry.textRank = rank;
    scoreMap.set(row.id, entry);
  });

  const merged = Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return merged.map(({ row, score, semanticRank, textRank }) => ({
    id: row.id,
    summary: row.summary,
    cleanedText: row.cleaned_text,
    type: row.type,
    priority: row.priority,
    categories: row.categories,
    status: row.status,
    deadline: row.deadline ? row.deadline.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    score,
    semanticRank,
    textRank,
  }));
}
