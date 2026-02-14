interface NotionPageInput {
  summary: string;
  type: string;
  categories: string[];
  content: string;
}

interface NotionPageResult {
  id: string;
  url: string;
}

export async function createNotionPage(
  apiToken: string,
  databaseId: string,
  thought: NotionPageInput
): Promise<NotionPageResult> {
  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties: {
        Name: {
          title: [{ text: { content: thought.summary } }],
        },
        Type: {
          select: { name: thought.type },
        },
        Categories: {
          multi_select: thought.categories.map((c) => ({ name: c })),
        },
      },
      children: [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{ text: { content: thought.content } }],
          },
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return { id: data.id, url: data.url };
}
