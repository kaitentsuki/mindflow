# MindFlow MVP — Detailní Flow

> Aktuální stav aplikace po dokončení Phase 1 scaffoldu + implementace.

---

## 1. Spuštění aplikace

```bash
nvm use 22                    # Node 22 (vyžadováno Next.js 16 + Prisma 6)
docker compose up -d          # PostgreSQL 16 + pgvector na portu 5433
pnpm prisma generate          # vygeneruje Prisma Client
pnpm prisma migrate dev       # aplikuje DB migrace
pnpm prisma db seed           # naplní 8 ukázkových thoughts + demo uživatel
pnpm dev                      # Next.js dev server na http://localhost:3000
```

---

## 2. Autentizace

### Flow:
1. Uživatel otevře jakoukoliv URL → **middleware** (`middleware.ts`) zachytí request
2. NextAuth middleware ověří JWT session → pokud neexistuje, redirect na `/login`
3. Na login stránce uživatel zadá **email + password**
4. `signIn("credentials", ...)` → NextAuth zavolá `authorize()` v `lib/auth.ts`
5. **MVP logika**: find-or-create by email (žádná reálná validace hesla)
6. Vytvoří se JWT token s `user.id` → redirect na Dashboard `/`
7. `SessionProvider` v layoutu zpřístupní session všem komponentám
8. Sidebar zobrazuje user avatar, jméno, email + sign-out button

### Chráněné routy:
- Vše kromě `/login` a `/api/auth/*` vyžaduje autentizaci
- API endpointy (`/api/thoughts`, `/api/process`, `/api/transcribe`) jsou **zatím otevřené** (vyjmuté z middleware pro snadné testování)

---

## 3. Nahrávání hlasu (Record page)

### Flow: `/record`

```
[Uživatel klikne Record]
    → getUserMedia({ audio: true })     // žádost o přístup k mikrofonu
    → MediaRecorder.start(1000)          // nahrává WebM/opus chunky po 1s
    → AudioContext + AnalyserNode        // real-time audio level data
    → UI: live timer (MM:SS) + audio level ring kolem tlačítka
    → Uživatel může: Pause / Resume / Cancel / Stop
```

### Po kliknutí na Stop:

```
[Stop]
    → MediaRecorder.stop()               // vrátí Blob s audio daty
    → UI: "Uploading audio..."

    → POST /api/transcribe (FormData)    // upload audio na backend
        → Validace: soubor existuje, max 25MB
        → OpenAI Whisper API (model: whisper-1)
            - vstup: audio buffer + filename
            - response_format: verbose_json (s timestampy segmentů)
            - fallback: mock transkript pokud chybí OPENAI_API_KEY
        → Vrací: { text, language, segments[], confidence }
    → UI: "Transcribing with Whisper..."

    → UI zobrazí transkript: text, jazyk, confidence %, segmenty s časy

    → POST /api/thoughts                 // uloží thought do DB
        - rawTranscript: přepsaný text
        - language: detekovaný jazyk
        - source: "voice"
        - audioDuration: délka nahrávky
    → UI: "Saving thought..."

    → Na pozadí: processExistingThought(thoughtId)  // LLM pipeline (fire-and-forget)
    → UI: "Thought saved! Tap to record again."
```

### AudioCapture třída (`lib/audio.ts`):
- **Formát**: WebM/opus (Chrome/Firefox), MP4 (Safari fallback)
- **Nastavení mikrofonu**: echoCancellation, noiseSuppression, 16kHz sample rate
- **Audio level**: AnalyserNode FFT → 0-255 hodnota pro vizualizaci
- **Elapsed time**: přesný čas bez pauz
- **Cleanup**: stopuje MediaStream tracks + zavírá AudioContext

---

## 4. LLM Processing Pipeline

### Trigger:
- Automaticky po `POST /api/thoughts` (fire-and-forget na pozadí)
- Manuálně přes `POST /api/process` s `{ thoughtId }` nebo `{ userId, rawTranscript }`

### Pipeline kroky (`lib/pipeline.ts`):

```
[Raw transcript]
    │
    ▼
┌─────────────────────────────────────────┐
│ 1. RELEVANCE FILTER (Claude Haiku)      │
│    Model: claude-haiku-4-5-20251001     │
│    Input: raw transcript                │
│    Output: { relevant: bool,            │
│              confidence: 0.0-1.0 }      │
│    Threshold: confidence >= 0.7         │
│    Bez API klíče: { relevant: true,     │
│                     confidence: 0.5 }   │
└─────────────────────────────────────────┘
    │
    ▼ (pokud relevant)
┌─────────────────────────────────────────┐
│ 2. ENTITY EXTRACTION (Claude Sonnet)    │
│    Model: claude-sonnet-4-5-20250929    │
│    Input: transcript + current date     │
│    Output:                              │
│      - type: task/idea/note/reminder/   │
│              journal                    │
│      - priority: 1-5                    │
│      - categories: ["work", "health"]   │
│      - entities:                        │
│          people: ["Martin"]             │
│          places: ["Praha"]              │
│          projects: ["projekt-X"]        │
│      - deadline: ISO datetime | null    │
│      - sentiment: -1.0 to 1.0          │
│      - action_items: ["Zavolat..."]     │
│      - summary: "1-2 věty shrnutí"     │
│    Bez API klíče: type="note",          │
│      priority=3, summary=prvních 200ch  │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 3. UPDATE THOUGHT v DB                  │
│    Prisma update s extrahovanými daty   │
│    (type, priority, categories,         │
│     entities, deadline, sentiment,      │
│     action_items, summary)              │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 4. EMBEDDING (OpenAI)                   │
│    Model: text-embedding-3-small        │
│    Input: summary + raw transcript      │
│    Output: vector[1536]                 │
│    Uložení: raw SQL UPDATE ...          │
│      SET embedding = $1::vector         │
│    Bez API klíče: přeskočí se           │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 5. FIND CONNECTIONS (pgvector)          │
│    Cosine similarity search:            │
│      1 - (embedding <=> query_vector)   │
│    Top-K: 5 nejpodobnějších thoughts    │
│    Threshold: similarity >= 0.82        │
│    Výsledek: INSERT do                  │
│      thought_connections tabulky        │
│    Bez embeddingů: přeskočí se          │
└─────────────────────────────────────────┘
```

### Graceful degradation:
| Chybí | Chování |
|-------|---------|
| `ANTHROPIC_API_KEY` | Thought se uloží jako "note", priority 3, bez kategorizace |
| `OPENAI_API_KEY` | STT vrací mock, žádné embeddings/connections |
| Oba klíče | Appka funguje, jen bez AI features |

---

## 5. Dashboard (/)

- **Server component** — data se načítají na serveru přes Prisma
- Zobrazuje:
  - 3 stat karty: Total thoughts, Active tasks, Upcoming deadlines
  - Seznam posledních 10 aktivních thoughts jako `ThoughtCard` komponenty
  - Prázdný state s výzvou k nahrání prvního thought

---

## 6. Library (/library)

- **Server component** — načte posledních 50 thoughts z DB
- Zobrazuje všechny thoughts (všechny statusy) jako `ThoughtCard`
- Každá karta zobrazuje: typ (barevný badge), prioritu (tečky), summary/text, kategorie, deadline, datum

---

## 7. Chat (/chat) — STUB

- **Client component** s chat UI
- Posílá zprávy na `POST /api/chat`
- Endpoint vrací stub odpověď (echo)
- **Phase 2**: RAG pipeline — query embedding → pgvector search → Claude Sonnet odpověď s kontextem

---

## 8. Settings (/settings) — PLACEHOLDER

- Placeholder sekce: Profile, Notifications, Privacy
- Zatím bez funkcionality

---

## 9. API Endpointy

| Endpoint | Metoda | Popis | Status |
|----------|--------|-------|--------|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth autentizace | Funkční |
| `/api/thoughts` | GET | Seznam thoughts s filtry (type, status, limit, offset) | Funkční |
| `/api/thoughts` | POST | Vytvoří thought + spustí LLM pipeline na pozadí | Funkční |
| `/api/thoughts/[id]` | GET | Detail jednoho thought | Funkční |
| `/api/thoughts/[id]` | PATCH | Update thought (status, priority, type...) | Funkční |
| `/api/thoughts/[id]` | DELETE | Smaže thought | Funkční |
| `/api/transcribe` | POST | Audio → Whisper STT → transkript | Funkční |
| `/api/process` | POST | Spustí LLM pipeline na thought/transcript | Funkční |
| `/api/search` | POST | Sémantické vyhledávání | Stub |
| `/api/chat` | POST | RAG conversational chat | Stub |

---

## 10. Databázové schéma

### Tabulky:
- **users** — id (UUID), email, name, preferences (JSONB)
- **thoughts** — id, user_id, raw_transcript, cleaned_text, summary, type (enum), priority, categories, sentiment, entities (JSONB), action_items, deadline, status (enum), embedding (vector 1536), audio metadata, language, source, timestamps
- **thought_connections** — thought_a_id, thought_b_id, similarity, connection_type
- **notifications** — user_id, thought_id, type, title, body, scheduled_for, sent_at, dismissed_at

### Indexy:
- `thoughts(user_id, status)` — rychlé filtrování
- `thoughts(user_id, type)` — filtr podle typu
- `thoughts(deadline)` — nadcházející deadliny
- `notifications(user_id, scheduled_for)` — plánované notifikace
- `thought_connections(thought_a_id, thought_b_id)` — unique constraint

---

## 11. Tech Stack (aktuální)

| Vrstva | Technologie | Verze |
|--------|-------------|-------|
| Runtime | Node.js | 22 |
| Package manager | pnpm | 10.x |
| Framework | Next.js (App Router, Turbopack) | 16.1 |
| Styling | Tailwind CSS | 4.x |
| ORM | Prisma | 6.19 |
| Auth | NextAuth.js (JWT, Credentials) | 4.x |
| State | Zustand (nainstalovaný, zatím nepoužitý) | 5.x |
| DB | PostgreSQL + pgvector | 16 |
| STT | OpenAI Whisper API | whisper-1 |
| LLM filter | Claude Haiku | claude-haiku-4-5-20251001 |
| LLM extraction | Claude Sonnet | claude-sonnet-4-5-20250929 |
| Embeddings | OpenAI | text-embedding-3-small |
| Infra | Docker Compose | pgvector/pgvector:pg16 |

---

## 12. Struktura souborů

```
mindflow/
├── app/
│   ├── layout.tsx              # Root layout (AuthProvider + AppShell + Sidebar)
│   ├── page.tsx                # Dashboard — stats + recent thoughts
│   ├── globals.css             # Tailwind import + CSS variables
│   ├── login/page.tsx          # Login stránka
│   ├── record/page.tsx         # Audio recording + STT + save
│   ├── library/page.tsx        # Seznam všech thoughts
│   ├── chat/page.tsx           # Chat UI (stub backend)
│   ├── settings/page.tsx       # Placeholder
│   └── api/
│       ├── auth/[...nextauth]/ # NextAuth handler
│       ├── thoughts/route.ts   # GET/POST thoughts
│       ├── thoughts/[id]/      # GET/PATCH/DELETE thought
│       ├── transcribe/route.ts # Audio → Whisper → transcript
│       ├── process/route.ts    # LLM pipeline trigger
│       ├── search/route.ts     # Stub: sémantické vyhledávání
│       └── chat/route.ts       # Stub: RAG chat
├── components/
│   ├── AppShell.tsx            # Layout wrapper (sidebar + main)
│   ├── AuthProvider.tsx        # NextAuth SessionProvider wrapper
│   ├── Sidebar.tsx             # Navigace + user info + sign-out
│   ├── ThoughtCard.tsx         # Zobrazení jednoho thought
│   └── ui/Button.tsx           # Reusable button
├── lib/
│   ├── audio.ts                # AudioCapture class (MediaRecorder)
│   ├── auth.ts                 # NextAuth config (credentials provider)
│   ├── db.ts                   # Prisma client singleton
│   ├── embeddings.ts           # OpenAI text-embedding-3-small
│   ├── llm.ts                  # Claude Haiku filter + Sonnet extraction
│   ├── pipeline.ts             # Orchestrace: filter → extract → embed → connections
│   └── stt.ts                  # Whisper STT + mock fallback
├── prisma/
│   ├── schema.prisma           # DB schéma (4 modely + pgvector)
│   ├── seed.ts                 # 8 ukázkových thoughts + demo user
│   └── migrations/             # SQL migrace
├── types/
│   └── next-auth.d.ts          # Rozšíření NextAuth typů (user.id)
├── middleware.ts                # Route protection (redirect na /login)
├── docker-compose.yml          # PostgreSQL + pgvector (port 5433)
├── .env.local                  # API klíče (ANTHROPIC, OPENAI, NEXTAUTH)
├── .env                        # DATABASE_URL pro Prisma CLI
├── .env.local.example          # Template pro env variables
└── .nvmrc                      # Node 22
```

---

## 13. Co chybí pro plný MVP (Phase 2+)

- [ ] Sémantické vyhledávání (`/api/search` — embedding query + pgvector)
- [ ] RAG chat (`/api/chat` — query → search → Claude odpověď)
- [ ] Live streaming transkripce (WebSocket + Deepgram)
- [ ] VAD (Silero Voice Activity Detection)
- [ ] Notifikace (Web Push API)
- [ ] Scheduler (deadline reminders, morning briefing)
- [ ] Thought editing v UI (inline edit, mark as done)
- [ ] Filtrování v Library (typ, kategorie, datum)
- [ ] Zustand store pro client-side state
