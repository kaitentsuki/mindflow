"use client";

import { create } from "zustand";

interface Source {
  thoughtId: string;
  summary: string;
  similarity?: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: Source[];
  createdAt: string;
}

interface Conversation {
  id: string;
  title: string | null;
  updatedAt: string;
  lastMessage?: string;
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  streamingSources: Source[];

  setConversations: (conversations: Conversation[]) => void;
  setActiveConversation: (id: string | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  setStreaming: (streaming: boolean) => void;
  appendStreamingContent: (text: string) => void;
  setStreamingSources: (sources: Source[]) => void;
  resetStreaming: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  isStreaming: false,
  streamingContent: "",
  streamingSources: [],

  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (id) => set({ activeConversationId: id }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message],
  })),
  setStreaming: (isStreaming) => set({ isStreaming }),
  appendStreamingContent: (text) => set((state) => ({
    streamingContent: state.streamingContent + text,
  })),
  setStreamingSources: (streamingSources) => set({ streamingSources }),
  resetStreaming: () => set({
    isStreaming: false,
    streamingContent: "",
    streamingSources: [],
  }),
}));
