"use client";

interface Conversation {
  id: string;
  title: string | null;
  updatedAt: string;
  lastMessage?: string;
}

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function ConversationList({ conversations, activeId, onSelect, onNew }: ConversationListProps) {
  return (
    <div className="flex h-full flex-col border-r border-zinc-200 dark:border-zinc-700">
      <div className="p-3">
        <button
          onClick={onNew}
          className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`w-full px-3 py-2.5 text-left text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
              activeId === conv.id
                ? "bg-zinc-100 dark:bg-zinc-800"
                : ""
            }`}
          >
            <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
              {conv.title || "New conversation"}
            </p>
            <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
              {conv.lastMessage || new Date(conv.updatedAt).toLocaleDateString("cs-CZ")}
            </p>
          </button>
        ))}

        {conversations.length === 0 && (
          <p className="p-3 text-center text-xs text-zinc-400">
            No conversations yet
          </p>
        )}
      </div>
    </div>
  );
}
