# 🧠 MindFlow — Project Specification

> Voice-first AI personal assistant that continuously listens, transcribes, categorizes, and proactively manages your thoughts, tasks, and ideas.

---

## 📋 Přehled projektu

**Koncept:** Aplikace funguje jako inteligentní diktafon — buď spuštěná na vyžádání, nebo běžící na pozadí. Zachycuje mluvenou řeč, přepisuje ji na text, LLM model text analyzuje a kategorizuje (úkol, nápad, poznámka, připomínka), přiřazuje priority a extrahuje entity (lidi, projekty, deadliny). Vše se ukládá do databáze s vektorovým vyhledáváním. Nad daty běží AI agent, který proaktivně generuje připomínky, propojuje souvislosti a poskytuje insights.

**Typ aplikace:** Web app (MVP)  
**Primární jazyk uživatelů:** Čeština + Angličtina  
**Přístup k DB:** PostgreSQL + pgvector (all-in-one pro relační data i vektorové vyhledávání)

---

## 🏗️ Architektura — 6 vrstev

### 1. Audio Capture Layer 🎙️

Zodpovědnost: Zachytávání zvuku z mikrofonu prohlížeče, detekce řeči, správa audio bufferů.

**Komponenty:**

- **Audio Service** — Web Audio API + MediaRecorder v prohlížeči. Spravuje přístup k mikrofonu, stream handling a lifecycle nahrávání.
- **Voice Activity Detection (VAD)** — Detekuje, kdy uživatel skutečně mluví vs. ticho/šum. Šetří bandwidth a compute — STT se spouští jen na reálnou řeč.
  - Technologie: `@ricky0123/vad-web` (Silero VAD portovaný do WebAssembly) nebo vlastní energy-based detector
- **Audio Buffer Manager** — Ring buffer posledních N sekund zvuku. Při detekci řeči odešle chunk na backend ke zpracování.
  - Chunk size: 5–15s segmenty
  - Formát: WAV/WebM z prohlížeče, převod na PCM 16kHz mono na backendu

**Implementační detaily pro web app:**
```
- navigator.mediaDevices.getUserMedia({ audio: true })
- MediaRecorder API pro chunked recording
- AudioWorklet pro real-time VAD processing
- WebSocket nebo chunked upload pro streaming na backend
```

---

### 2. Speech-to-Text Layer 📝

Zodpovědnost: Převod audio chunků na text, detekce jazyka, sestavení kompletních transkripcí.

**Komponenty:**

- **STT Engine** — Hlavní přepis řeči na text.
  - Primární: **Deepgram Nova-2** (real-time streaming, dobrá čeština, WebSocket API)
  - Fallback: **OpenAI Whisper API** (batch processing, spolehlivý)
  - Budoucí lokální varianta: Whisper.cpp přes WebAssembly (privacy mode)
- **Language Detection** — Automatická detekce jazyka (Whisper to umí nativně, Deepgram taky).
- **Transcript Assembler** — Spojuje chunky do souvislých transkripcí, řeší překryvy a časové značky.

**API kontrakt:**
```
POST /api/transcribe
Content-Type: multipart/form-data
Body: { audio: Blob, language?: "cs" | "en" | "auto" }

Response: {
  text: string,
  language: "cs" | "en",
  segments: [{ start: number, end: number, text: string }],
  confidence: number
}
```

---

### 3. LLM Processing Layer 🧠

Zodpovědnost: Filtrace relevance, strukturovaná extrakce dat, generování embeddingů, hledání souvislostí.

**Komponenty:**

- **Relevance Filter** — První gate: rozhoduje, jestli přepis stojí za uložení. Filtruje small talk, opakování, nesrozumitelné fragmenty.
  - Model: **Claude Haiku** (rychlý, levný)
  - Prompt koncept: "Vyhodnoť, zda následující přepis obsahuje zapamatování hodnou myšlenku, úkol, nápad nebo informaci. Odpověz JSON: { relevant: boolean, confidence: number }"
  - Threshold: confidence >= 0.7

- **Entity Extractor** — Strukturovaná extrakce z přirozeného jazyka.
  - Model: **Claude Sonnet** (structured output, přesný)
  - Extrahuje:
    - `type`: "task" | "idea" | "note" | "reminder" | "journal"
    - `priority`: 1–5
    - `category`: string[] (auto-generated, např. "práce", "zdraví", "projekt-X")
    - `entities`: { people: string[], places: string[], projects: string[] }
    - `deadline`: datetime | null (parsuje relativní časy: "zítra", "příští týden", "v pátek")
    - `sentiment`: -1.0 až 1.0
    - `action_items`: string[] (konkrétní kroky k vykonání)
    - `summary`: string (1-2 věty shrnutí)

  - Prompt koncept:
    ```
    Analyzuj následující přepis mluvené řeči a extrahuj strukturovaná data.
    Dnešní datum: {current_date}
    Přepis: "{transcript}"
    
    Odpověz POUZE validním JSON objektem podle tohoto schématu:
    {
      "type": "task" | "idea" | "note" | "reminder" | "journal",
      "priority": 1-5,
      "category": ["string"],
      "entities": {
        "people": ["string"],
        "places": ["string"],
        "projects": ["string"]
      },
      "deadline": "ISO datetime nebo null",
      "sentiment": -1.0 až 1.0,
      "action_items": ["string"],
      "summary": "string"
    }
    ```

- **Embedding Generator** — Vektorové embeddingy pro sémantické vyhledávání.
  - Model: **OpenAI text-embedding-3-small** (1536 dimenzí, levný, dobrý multilingual)
  - Alternativa: Voyage AI (lepší multilingual, dražší)
  - Generuje embedding z `cleaned_text` + `summary`

- **Connection Finder** — Hledá sémantické souvislosti s existujícími záznamy.
  - Cosine similarity search přes pgvector (top-k, k=5)
  - Threshold: similarity >= 0.82
  - Cross-category matching (úkol může souviset s nápadem)

---

### 4. Storage Layer 💾

Zodpovědnost: Persistentní úložiště pro všechna data — strukturovaná metadata i vektorové embeddingy.

**Technologie: PostgreSQL + pgvector**

Jeden database engine pro vše — jednodušší infra, jednodušší backup, ACID transakce přes celý datový model.

**Schéma databáze:**

```sql
-- Aktivace pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Hlavní tabulka myšlenek/záznamů
CREATE TABLE thoughts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- Obsah
  raw_transcript TEXT NOT NULL,
  cleaned_text TEXT NOT NULL,
  summary TEXT,
  
  -- Klasifikace (z LLM)
  type VARCHAR(20) NOT NULL CHECK (type IN ('task', 'idea', 'note', 'reminder', 'journal')),
  priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  categories TEXT[] DEFAULT '{}',
  sentiment FLOAT,
  
  -- Entity extraction
  entities JSONB DEFAULT '{}',
  -- Formát: { "people": [], "places": [], "projects": [] }
  
  action_items TEXT[] DEFAULT '{}',
  
  -- Časové údaje
  deadline TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done', 'snoozed', 'archived')),
  
  -- Vektor pro sémantické vyhledávání
  embedding vector(1536),
  
  -- Audio reference (volitelné)
  audio_url TEXT,
  audio_duration_seconds FLOAT,
  
  -- Metadata
  language VARCHAR(5) DEFAULT 'cs',
  source VARCHAR(20) DEFAULT 'voice', -- 'voice', 'manual', 'import'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vztahy mezi myšlenkami
CREATE TABLE thought_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thought_a_id UUID NOT NULL REFERENCES thoughts(id) ON DELETE CASCADE,
  thought_b_id UUID NOT NULL REFERENCES thoughts(id) ON DELETE CASCADE,
  similarity FLOAT NOT NULL,
  connection_type VARCHAR(20) DEFAULT 'semantic', -- 'semantic', 'manual', 'temporal'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(thought_a_id, thought_b_id)
);

-- Notifikace / připomínky
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  thought_id UUID REFERENCES thoughts(id),
  type VARCHAR(20) NOT NULL, -- 'deadline', 'reminder', 'insight', 'digest'
  title TEXT NOT NULL,
  body TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Uživatelé
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  preferences JSONB DEFAULT '{}',
  -- Formát: { "language": "cs", "notification_hours": [8, 22], "categories": [] }
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexy
CREATE INDEX idx_thoughts_user_status ON thoughts(user_id, status);
CREATE INDEX idx_thoughts_user_type ON thoughts(user_id, type);
CREATE INDEX idx_thoughts_deadline ON thoughts(deadline) WHERE deadline IS NOT NULL;
CREATE INDEX idx_thoughts_embedding ON thoughts USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_notifications_scheduled ON notifications(user_id, scheduled_for) WHERE sent_at IS NULL;
```

**Klíčové SQL dotazy:**

```sql
-- Sémantické vyhledávání: "co jsem říkal o tom projektu?"
SELECT id, summary, cleaned_text, type, priority,
       1 - (embedding <=> $1::vector) AS similarity
FROM thoughts
WHERE user_id = $2 AND status != 'archived'
ORDER BY embedding <=> $1::vector
LIMIT 10;

-- Nadcházející deadliny
SELECT * FROM thoughts
WHERE user_id = $1 AND deadline IS NOT NULL 
  AND deadline > NOW() AND status = 'active'
ORDER BY deadline ASC;

-- Nevyřešené úkoly podle priority
SELECT * FROM thoughts
WHERE user_id = $1 AND type = 'task' AND status = 'active'
ORDER BY priority DESC, created_at DESC;
```

---

### 5. AI Agent / Orchestrator Layer 🤖

Zodpovědnost: Proaktivní zpracování dat — připomínky, insights, propojování myšlenek, digest.

**Komponenty:**

- **Scheduler Agent** — Cron-based jobs (nebo BullMQ recurring jobs):
  - Každých 15 min: kontrola deadlinů, generování připomínek
  - Každý den 8:00: morning briefing (dnešní úkoly, deadliny)
  - Každý pátek 17:00: weekly digest
  - Event-driven: po uložení nového thought → hledání connections

- **Insight Engine** — RAG pipeline nad všemi záznamy uživatele:
  - Hledá opakující se témata
  - Detekuje nevyřešené problémy (staré úkoly bez progressu)
  - Sentiment trendy (je uživatel dlouhodobě stressed?)
  - Model: Claude Sonnet s kontextem z RAG

- **Notification Manager** — Rozhoduje CO, KDY a JAK doručit:
  - Respektuje uživatelské preference (notification_hours)
  - Urgency scoring: deadline za hodinu > weekly digest
  - Deduplikace: neposílat stejnou připomínku 2x
  - Kanály: Web push notifications (Service Worker + Push API)

- **Conversational Interface** — RAG-powered chat:
  - Uživatel se ptá přirozeným jazykem
  - Pipeline: query → embedding → pgvector similarity search → top-k results → Claude Sonnet generuje odpověď s kontextem
  - Podporuje follow-up otázky (chat history)

---

### 6. UI / Client Layer 📱

Zodpovědnost: Uživatelské rozhraní — web aplikace.

**Tech stack:**
- **Framework:** Next.js 14+ (App Router)
- **Styling:** Tailwind CSS
- **State management:** Zustand nebo React Context
- **Real-time:** WebSocket pro live transkripci
- **Audio:** Web Audio API + MediaRecorder

**Hlavní obrazovky:**

1. **Dashboard** — Timeline view dnešních záznamů, nadcházející deadliny, quick stats
2. **Record** — Hlavní nahrávací interface s live transkripci, waveform vizualizace
3. **Library** — Všechny záznamy s filtrováním (typ, kategorie, datum, priorita), full-text + sémantické vyhledávání
4. **Chat** — Conversational interface: "Co jsem říkal o tom projektu s Petrem?"
5. **Settings** — Profil, notification preferences, privacy nastavení, kategorie

**UI komponenty:**
- Record button (floating, persistent) — tap to start/stop
- Thought card — zobrazení jednoho záznamu s typem, prioritou, akcemi (done/snooze/edit/delete)
- Search bar — hybrid full-text + semantic search
- Notification center — přehled připomínek a insights

---

## 🛠️ Tech Stack (MVP — Web App)

| Vrstva | Technologie |
|--------|------------|
| Frontend | Next.js 14+ (App Router), React, Tailwind CSS |
| Backend | Next.js API Routes (nebo samostatný Node.js + Fastify) |
| Databáze | PostgreSQL + pgvector (Supabase nebo self-hosted) |
| ORM | Prisma nebo Drizzle ORM |
| Auth | NextAuth.js / Supabase Auth |
| STT | Deepgram Nova-2 (primary), OpenAI Whisper API (fallback) |
| LLM | Anthropic Claude API — Haiku (filter), Sonnet (extraction + chat) |
| Embeddings | OpenAI text-embedding-3-small |
| Queue | BullMQ + Redis (async processing pipeline) |
| Notifications | Web Push API + Service Worker |
| File storage | S3 / Supabase Storage (audio archiv) |
| Deployment | Vercel (frontend) + Railway/Fly.io (backend + DB) |

---

## 🔄 Data Flow — Hlavní pipeline

```
1. [Mikrofon] → Web Audio API → Audio chunks (WebM/WAV)
       ↓
2. [VAD] → Silero VAD (WebAssembly) → Filtruje ticho, posílá jen řeč
       ↓
3. [Upload] → WebSocket nebo chunked POST → Backend
       ↓
4. [STT] → Deepgram API → Raw transcript + timestamps
       ↓
5. [Relevance Filter] → Claude Haiku → "Stojí to za uložení?" (Y/N)
       ↓ (jen pokud Y)
6. [Entity Extractor] → Claude Sonnet → Strukturovaná data (JSON)
       ↓
7. [Embedding] → OpenAI embedding API → vector[1536]
       ↓
8. [Storage] → PostgreSQL + pgvector → INSERT thought
       ↓
9. [Connection Finder] → pgvector similarity search → Propojení s existujícími záznamy
       ↓
10. [Agent] → Scheduler kontroluje deadliny, generuje notifikace
       ↓
11. [UI] → Push notification / Dashboard update
```

---

## ⚡ Klíčové architektonické principy

1. **Async Pipeline** — Každý krok běží asynchronně přes message queue (BullMQ). Frontend odešle audio a okamžitě dostane potvrzení. STT, LLM processing a embedding běží na pozadí. UI se aktualizuje přes WebSocket/SSE.

2. **Offline-First** (budoucí) — Pro web app zatím ne kritické, ale architektura by měla počítat s tím, že audio se může lokálně bufferovat a odeslat později.

3. **Privacy by Design** — Audio se po transkripci maže z processing pipeline (ukládá se jen volitelně do archívu). LLM dostává jen text, nikdy surové audio. Budoucí možnost plně lokálního pipeline (Whisper.cpp WASM + lokální LLM).

4. **Feedback Loop** — Uživatelské opravy přepisů a kategorizací se logují. Tyto corrective signals lze použít pro budoucí fine-tuning promptů nebo modelů.

5. **Tiered LLM Usage** — Haiku pro rychlé, levné rozhodování (filter). Sonnet pro přesnou extrakci a generování. Šetří náklady i latenci.

---

## 🚀 MVP Roadmap

### Phase 1 — Proof of Concept (2–3 týdny)
- [ ] Projekt setup: Next.js + PostgreSQL + pgvector
- [ ] Auth (NextAuth / Supabase Auth)
- [ ] Record button → MediaRecorder → upload audio na backend
- [ ] STT integrace (Deepgram nebo Whisper API)
- [ ] Základní LLM kategorizace (Claude Sonnet — type, priority, summary)
- [ ] DB schema + CRUD pro thoughts
- [ ] Seznam záznamů s filtrováním (typ, datum)
- [ ] Základní UI: Record + Library views

### Phase 2 — Smart Features (3–4 týdny)
- [ ] VAD integrace (Silero VAD WASM) — nahrávání jen při řeči
- [ ] Embedding generování + pgvector sémantické vyhledávání
- [ ] Full entity extraction (people, projects, deadlines)
- [ ] Connection finder — automatické propojování souvisejících thoughts
- [ ] Conversational interface (RAG chat) — "co jsem říkal o..."
- [ ] Live transkripce přes WebSocket (streaming STT)

### Phase 3 — AI Agent (4–6 týdnů)
- [ ] BullMQ scheduler — periodické joby
- [ ] Proaktivní notifikace (deadline reminders, forgotten tasks)
- [ ] Web Push notifications (Service Worker)
- [ ] Morning briefing + Weekly digest
- [ ] Insight engine — pattern detection, sentiment trends
- [ ] Connection suggestions ("tohle souvisí s tím, co jsi říkal minulý týden")

### Phase 4 — Polish & Scale (ongoing)
- [ ] Continuous recording mode (background tab)
- [ ] Integrace: Google Calendar, Todoist, Notion
- [ ] Multi-language auto-detection
- [ ] Audio playback pro kontext
- [ ] Export (Markdown, CSV, Notion)
- [ ] Mobile-responsive PWA
- [ ] Collaborative features (sdílené projekty/prostory)

---

## ⚠️ Rizika a mitigace

| Riziko | Mitigace |
|--------|----------|
| Battery/resource drain (continuous recording) | VAD je lightweight. Pro web app: recording jen v aktivním tabu, budoucí PWA/Service Worker |
| Privacy & GDPR | Audio se maže po transkripci. Explicitní consent. Data retention policy. Budoucí lokální mode |
| STT přesnost v češtině | Deepgram + Whisper mají solidní CZ support. User corrections jako feedback |
| LLM náklady | Tiered: Haiku (filter) je ~$0.25/1M tokens, Sonnet jen pro extrakci. Caching, batching |
| Information overload | Agresivní relevance filtering. Smart digest místo raw feed. Uživatel kontroluje granularitu |
| WebSocket reliability | Reconnection logic, exponential backoff, local buffer pro ztracené chunky |

---

## 📁 Navrhovaná struktura projektu

```
mindflow/
├── app/                          # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx                  # Landing / Dashboard
│   ├── record/
│   │   └── page.tsx              # Recording interface
│   ├── library/
│   │   └── page.tsx              # Thoughts library
│   ├── chat/
│   │   └── page.tsx              # Conversational RAG interface
│   ├── settings/
│   │   └── page.tsx
│   └── api/
│       ├── auth/[...nextauth]/
│       ├── transcribe/
│       │   └── route.ts          # Audio upload → STT
│       ├── thoughts/
│       │   └── route.ts          # CRUD thoughts
│       ├── search/
│       │   └── route.ts          # Semantic search
│       ├── chat/
│       │   └── route.ts          # RAG conversational endpoint
│       └── webhooks/
│           └── route.ts          # Deepgram webhooks etc.
├── components/
│   ├── ui/                       # Shared UI components
│   ├── RecordButton.tsx
│   ├── ThoughtCard.tsx
│   ├── ThoughtList.tsx
│   ├── SearchBar.tsx
│   ├── ChatInterface.tsx
│   └── WaveformVisualizer.tsx
├── lib/
│   ├── db.ts                     # Prisma/Drizzle client
│   ├── stt.ts                    # STT service (Deepgram/Whisper)
│   ├── llm.ts                    # Claude API wrapper
│   ├── embeddings.ts             # OpenAI embeddings
│   ├── audio.ts                  # Audio processing utils
│   ├── vad.ts                    # VAD integration
│   └── notifications.ts          # Web Push utils
├── workers/
│   ├── processThought.ts         # BullMQ worker: STT → LLM → embed → store
│   ├── findConnections.ts        # Connection finder worker
│   └── scheduler.ts              # Cron jobs: reminders, digests
├── prisma/
│   └── schema.prisma             # DB schema
├── public/
│   └── sw.js                     # Service Worker for push notifications
├── .env.local
├── package.json
└── README.md
```

---

## 🔑 Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/mindflow

# Auth
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000

# STT
DEEPGRAM_API_KEY=...
OPENAI_API_KEY=...          # Fallback STT + Embeddings

# LLM
ANTHROPIC_API_KEY=...

# Queue
REDIS_URL=redis://localhost:6379

# Storage
S3_BUCKET=mindflow-audio
S3_REGION=eu-central-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# Push Notifications
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

---

## 💡 Poznámky pro implementaci

- **pgvector setup:** `CREATE EXTENSION vector;` — při použití Supabase je pgvector předinstalovaný.
- **Embedding dimenze:** OpenAI text-embedding-3-small = 1536 dimenzí. Při definici sloupce: `embedding vector(1536)`.
- **IVFFlat index:** Vytvořit až po naplnění tabulky alespoň 1000+ záznamy. Do té doby stačí brute-force scan.
- **Deepgram streaming:** Podporuje WebSocket real-time transcription — ideální pro live preview při nahrávání.
- **Claude structured output:** Používat JSON mode + response schema pro konzistentní extraction.
- **BullMQ:** Potřebuje Redis. Pro MVP lze začít s in-process queue a Redis přidat později.
