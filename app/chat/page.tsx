"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { ChatMessage } from "@/components/ChatMessage";
import { ConversationList } from "@/components/ConversationList";
import { useChatStore } from "@/lib/stores/chat";

export default function ChatPage() {
  const {
    conversations,
    activeConversationId,
    messages,
    isStreaming,
    streamingContent,
    streamingSources,
    setConversations,
    setActiveConversation,
    setMessages,
    addMessage,
    setStreaming,
    appendStreamingContent,
    setStreamingSources,
    resetStreaming,
  } = useChatStore();

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  // Load conversations on mount
  useEffect(() => {
    fetchConversations();
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const fetchConversations = async () => {
    try {
      const res = await fetch("/api/conversations");
      const data = await res.json();
      setConversations(
        data.conversations.map((c: any) => ({
          id: c.id,
          title: c.title,
          updatedAt: c.updatedAt,
          lastMessage: c.messages?.[0]?.content?.slice(0, 50),
        }))
      );
    } catch { /* ignore */ }
  };

  const loadConversation = async (id: string) => {
    setActiveConversation(id);
    resetStreaming();
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data = await res.json();
      setMessages(
        data.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          sources: m.sources || [],
          createdAt: m.createdAt,
        }))
      );
    } catch { /* ignore */ }
  };

  const startNewConversation = () => {
    setActiveConversation(null);
    setMessages([]);
    resetStreaming();
  };

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    setInput("");

    // Optimistic: add user message
    addMessage({
      id: `temp-${Date.now()}`,
      role: "user",
      content: userMessage,
      sources: [],
      createdAt: new Date().toISOString(),
    });

    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          conversationId: activeConversationId,
        }),
      });

      if (!res.ok) {
        throw new Error("Chat request failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let currentSources: any[] = [];
      let fullContent = "";
      let newConversationId = activeConversationId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "conversation") {
              newConversationId = data.conversationId;
              if (!activeConversationId) {
                setActiveConversation(newConversationId);
              }
            } else if (data.type === "sources") {
              currentSources = data.sources;
              setStreamingSources(data.sources);
            } else if (data.type === "text") {
              fullContent += data.content;
              appendStreamingContent(data.content);
            } else if (data.type === "done") {
              // Add final assistant message
              addMessage({
                id: `msg-${Date.now()}`,
                role: "assistant",
                content: fullContent,
                sources: currentSources,
                createdAt: new Date().toISOString(),
              });
              resetStreaming();
            }
          } catch { /* ignore parse errors */ }
        }
      }

      // Refresh conversation list
      fetchConversations();
    } catch {
      addMessage({
        id: `err-${Date.now()}`,
        role: "assistant",
        content: "Error: Could not get a response.",
        sources: [],
        createdAt: new Date().toISOString(),
      });
      resetStreaming();
    }
  }, [input, isStreaming, activeConversationId]);

  return (
    <div className="flex h-full">
      {/* Conversation sidebar */}
      {sidebarOpen && (
        <>
          {/* Mobile: overlay backdrop */}
          <div
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-40 w-64 md:relative md:z-auto md:flex-shrink-0">
            <ConversationList
              conversations={conversations}
              activeId={activeConversationId}
              onSelect={(id) => {
                loadConversation(id);
                if (isMobile) setSidebarOpen(false);
              }}
              onNew={() => {
                startNewConversation();
                if (isMobile) setSidebarOpen(false);
              }}
            />
          </div>
        </>
      )}

      {/* Main chat area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Chat</h1>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 p-4">
          {messages.length === 0 && !isStreaming && (
            <div className="flex h-full items-center justify-center text-zinc-400">
              <div className="text-center">
                <p className="text-lg">Ask about your thoughts</p>
                <p className="mt-1 text-sm">Powered by RAG — searches your captured thoughts for context</p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              role={msg.role}
              content={msg.content}
              sources={msg.sources}
            />
          ))}

          {/* Streaming message */}
          {isStreaming && streamingContent && (
            <ChatMessage
              role="assistant"
              content={streamingContent}
              sources={streamingSources}
              isStreaming
            />
          )}

          {isStreaming && !streamingContent && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-zinc-200 px-4 py-2.5 text-sm text-zinc-500 dark:bg-zinc-800">
                Thinking...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2 border-t border-zinc-200 p-4 dark:border-zinc-700">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Ask about your thoughts..."
            disabled={isStreaming}
            className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <Button onClick={sendMessage} disabled={isStreaming || !input.trim()}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
