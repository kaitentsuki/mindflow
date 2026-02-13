# MindFlow — Roadmap

> Plán vývoje po dokončení MVP scaffoldu (Phase 1).

---

## Phase 1 — MVP Scaffold (DONE)

- [x] Next.js 16 + TypeScript + Tailwind CSS + pnpm
- [x] PostgreSQL + pgvector v Dockeru
- [x] Prisma schéma (users, thoughts, connections, notifications)
- [x] NextAuth credentials provider + login page + route protection
- [x] Audio capture (MediaRecorder + Web Audio API)
- [x] STT integrace (OpenAI Whisper API)
- [x] LLM pipeline (Claude Haiku filter + Sonnet extraction)
- [x] OpenAI embeddings (text-embedding-3-small, 1536 dim)
- [x] pgvector connection finder (cosine similarity)
- [x] UI: Dashboard, Record, Library, Chat (stub), Settings (placeholder)
- [x] CRUD API pro thoughts
- [x] Seed data + demo user

---

## Phase 2 — Smart Features

### Sémantické vyhledávání
- [ ] Implementovat `/api/search` — embedding query → pgvector similarity search
- [ ] Hybrid search: full-text (PostgreSQL `tsvector`) + sémantický (pgvector)
- [ ] Search bar komponenta v Library s výsledky
- [ ] Filtrování v Library (typ, kategorie, datum, priorita)

### RAG Chat
- [ ] Implementovat `/api/chat` — RAG pipeline:
  - Query → embedding → pgvector search (top-k kontextové thoughts)
  - Claude Sonnet generuje odpověď s kontextem z nalezených thoughts
- [ ] Chat history (uložení konverzací)
- [ ] Streaming odpovědí (Server-Sent Events)
- [ ] Follow-up otázky s kontextem předchozí konverzace

### Live transkripce
- [ ] Deepgram Nova-2 WebSocket streaming (real-time přepis při nahrávání)
- [ ] Live preview transkriptu během mluvení
- [ ] Přepnutí z Whisper batch na Deepgram streaming jako primární STT

### VAD (Voice Activity Detection)
- [ ] Integrace `@ricky0123/vad-web` (Silero VAD v WebAssembly)
- [ ] Automatická detekce řeči vs. ticho
- [ ] Nahrávání jen při řeči — šetří bandwidth a compute

### Thought management v UI
- [ ] Inline editace thoughts (text, typ, priorita, kategorie)
- [ ] Mark as done / snooze / archive akce na ThoughtCard
- [ ] Drag & drop řazení priorit
- [ ] Detail view thought s connections a historií

---

## Phase 3 — AI Agent & Notifikace

### Proaktivní notifikace
- [ ] Web Push API + Service Worker registrace
- [ ] Notification permission request flow v UI
- [ ] VAPID key generation + push subscription storage

### Scheduler Agent
- [ ] Deadline checker (každých 15 min) — generuje upozornění na blížící se deadliny
- [ ] Morning briefing (denně 8:00) — souhrn dnešních úkolů a deadlinů
- [ ] Weekly digest (pátek 17:00) — týdenní přehled, nedokončené tasky, trendy
- [ ] BullMQ + Redis pro recurring jobs (nebo cron v MVP)

### Insight Engine
- [ ] Detekce opakujících se témat a vzorců
- [ ] Nevyřešené problémy (staré tasky bez progressu)
- [ ] Sentiment trendy (dlouhodobý stress?)
- [ ] Automatické suggestions ("Tohle souvisí s tím, co jsi říkal minulý týden")

### Notification Manager
- [ ] Respektuje user preferences (notification_hours)
- [ ] Urgency scoring (deadline za hodinu > weekly digest)
- [ ] Deduplikace notifikací
- [ ] Notification center v UI

---

## Phase 4 — Polish & Integrace

### UX vylepšení
- [ ] Mobile-responsive layout (sidebar → bottom nav)
- [ ] Dark/light mode toggle
- [ ] Keyboard shortcuts (R = record, / = search)
- [ ] Onboarding flow pro nové uživatele
- [ ] Audio playback u thoughts (volitelný archiv)
- [ ] Waveform vizualizace při nahrávání

### Integrace
- [ ] Google Calendar — automatické vytváření eventů z deadlinů
- [ ] Todoist / Notion — sync tasků
- [ ] Export (Markdown, CSV, JSON)
- [ ] Import z jiných nástrojů

### Continuous Recording Mode
- [ ] Background recording v aktivním tabu
- [ ] Automatické segmentování na thoughts pomocí VAD + silence detection
- [ ] Configurable sensitivity a chunk délka

### Auth vylepšení
- [ ] OAuth providers (Google, GitHub)
- [ ] Password hashing (bcrypt) + registrace
- [ ] Email verification
- [ ] Password reset flow

---

## Phase 5 — Scale & Production

### Infrastruktura
- [ ] Deployment: Vercel (frontend) + Railway/Fly.io (DB)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Environment management (staging, production)
- [ ] Database backups + monitoring

### Performance
- [ ] IVFFlat index na pgvector (po 1000+ thoughts)
- [ ] Connection pooling (PgBouncer)
- [ ] API rate limiting
- [ ] Audio compression před uplodem
- [ ] Lazy loading v Library (infinite scroll)

### Privacy & Security
- [ ] Audio retention policy (auto-delete po N dnech)
- [ ] Data export (GDPR compliance)
- [ ] End-to-end encryption option
- [ ] Audit log

### Multi-user
- [ ] Sdílené projekty / prostory
- [ ] Team thoughts a collaborative tagging
- [ ] Role-based access

---

## Odhad priorit

| Feature | Impact | Effort | Priorita |
|---------|--------|--------|----------|
| Sémantické vyhledávání | Vysoký | Nízký | P1 |
| RAG Chat | Vysoký | Střední | P1 |
| Thought editing v UI | Vysoký | Nízký | P1 |
| Library filtrování | Střední | Nízký | P1 |
| Live transkripce (Deepgram) | Vysoký | Střední | P2 |
| VAD | Střední | Střední | P2 |
| Web Push notifikace | Vysoký | Střední | P2 |
| Scheduler (deadline reminders) | Vysoký | Střední | P2 |
| Google Calendar integrace | Střední | Střední | P3 |
| Continuous recording | Střední | Vysoký | P3 |
| Mobile responsive | Vysoký | Střední | P3 |
| OAuth (Google login) | Střední | Nízký | P3 |
