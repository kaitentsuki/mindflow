# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MindFlow is a voice-first AI personal assistant web app. It continuously listens, transcribes speech, categorizes content via LLM, and proactively manages thoughts/tasks/ideas. Primary user languages: Czech + English.

Full specification: `MINDFLOW_SPEC.md`

## Tech Stack

- **Frontend:** Next.js 14+ (App Router), React, Tailwind CSS, Zustand
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL + pgvector (relational + vector search in one DB)
- **ORM:** Prisma or Drizzle
- **Auth:** NextAuth.js or Supabase Auth
- **STT:** Deepgram Nova-2 (primary, streaming WebSocket), OpenAI Whisper API (fallback)
- **LLM:** Anthropic Claude — Haiku for relevance filtering, Sonnet for entity extraction + chat
- **Embeddings:** OpenAI text-embedding-3-small (1536 dimensions)
- **Queue:** BullMQ + Redis (async processing pipeline)
- **Notifications:** Web Push API + Service Worker
- **Storage:** S3 / Supabase Storage (audio archive)

## Architecture — 6 Layers

1. **Audio Capture** — Browser Web Audio API + MediaRecorder + Silero VAD (WASM) for voice activity detection. Sends 5-15s audio chunks via WebSocket.
2. **Speech-to-Text** — Deepgram Nova-2 streaming or Whisper batch. Outputs transcript with timestamps, language, confidence.
3. **LLM Processing** — Pipeline: relevance filter (Haiku, threshold ≥0.7) → entity extraction (Sonnet, outputs type/priority/categories/entities/deadline/sentiment/action_items/summary) → embedding generation → connection finder (pgvector cosine similarity ≥0.82).
4. **Storage** — PostgreSQL + pgvector. Core tables: `thoughts`, `thought_connections`, `notifications`, `users`. Embedding column: `vector(1536)` with IVFFlat index.
5. **AI Agent/Orchestrator** — Scheduler (deadline checks every 15min, morning briefing 8:00, weekly digest Friday 17:00), Insight Engine (RAG over user data), Notification Manager (respects user hours, urgency scoring), Conversational Interface (RAG chat).
6. **UI** — Pages: Dashboard, Record, Library, Chat, Settings. Key components: floating record button, thought cards, hybrid search bar.

## Data Flow Pipeline

Audio → VAD filter → Upload → STT → Relevance filter (Haiku) → Entity extraction (Sonnet) → Embedding → PostgreSQL+pgvector → Connection finder → Agent scheduler → Push notifications / UI update

Each step runs async via BullMQ. Frontend gets immediate confirmation; processing happens in background with WebSocket/SSE updates.

## Key Design Decisions

- **Tiered LLM usage:** Haiku for cheap/fast filtering, Sonnet for precise extraction and chat. This optimizes cost and latency.
- **Single DB (PostgreSQL + pgvector):** No separate vector DB. Simpler infra, ACID transactions across the full data model.
- **Privacy by design:** Audio deleted after transcription (optional archive). LLM receives only text.
- **Thought types:** `task`, `idea`, `note`, `reminder`, `journal` — each with priority 1-5, categories, entities (people/places/projects), optional deadline.
- **IVFFlat index:** Create only after 1000+ rows. Use brute-force scan before that.
- **For MVP:** Can start with in-process queue instead of Redis/BullMQ.
