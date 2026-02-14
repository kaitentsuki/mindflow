interface TodoistTaskInput {
  content: string;
  description?: string;
  dueDate?: string;
  priority?: number;
}

interface TodoistTaskResult {
  id: string;
}

export async function createTodoistTask(
  apiToken: string,
  task: TodoistTaskInput
): Promise<TodoistTaskResult> {
  const body: Record<string, unknown> = {
    content: task.content,
  };
  if (task.description) body.description = task.description;
  if (task.dueDate) body.due_date = task.dueDate.split("T")[0]; // YYYY-MM-DD
  // Todoist priority: 1 = normal, 4 = urgent (inverted from our 1-5 scale)
  if (task.priority) body.priority = Math.min(4, Math.max(1, 5 - task.priority + 1));

  const res = await fetch("https://api.todoist.com/rest/v2/tasks", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Todoist API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return { id: data.id };
}
