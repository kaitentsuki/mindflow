"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error: Could not get a response." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          Chat
        </h1>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          Ask about your thoughts — powered by RAG (coming in Phase 2).
        </p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-zinc-400">
            Start a conversation...
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-zinc-200 px-4 py-2.5 text-sm text-zinc-500 dark:bg-zinc-800">
              Thinking...
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Ask about your thoughts..."
          className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <Button onClick={sendMessage} disabled={loading || !input.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}
