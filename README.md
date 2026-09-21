# AI Study Assistant — RAG Voice Bot 

A full-stack academic AI assistant with document understanding (RAG), conversational AI, voice input/output, and a visual PDF inspector. Built with Clean Architecture principles.

> ** Note on the repository contents:** This repository is my internship working directory. It contains **some obsolete files that were created along the way** during earlier internship tasks (e.g., standalone TypeScript exercises, dummy HTML files, early Express experiments). Only the files referenced in the **Project Structure** section below belong to the AI Study Assistant project. Everything else can be safely ignored.

---

## Table of Contents

- [What It Does](#what-it-does)
- [How the AI Chatbot Works](#how-the-ai-chatbot-works)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [API Workflow](#api-workflow)
- [Project Structure](#project-structure)
- [Prompt Engineering](#prompt-engineering)
- [Common Commands](#common-commands)
- [What You Must Improvise](#what-you-must-improvise)
- [License](#license)

---

## What It Does

The system has five main features:

### 1. Document Hub

![Document Preview](docs/screenshots/doc-preview.png)

Upload PDFs. The backend extracts text, structure, and layout-aware bounding boxes, generates vector embeddings, and prepares them for AI queries.

### 2. General AI Chat

![AI Chat Interface](docs/screenshots/ai-chat-interface.png)

A conversational assistant for coursework, coding, and general questions. Not restricted to uploaded documents.

### 3. RAG & Voice Chat

![Simple Sample Question](docs/screenshots/simple-sample-question.png)

Ask questions about your uploaded documents via text or voice. The AI retrieves semantically similar chunks and answers using them as grounding context.

### 4. Text-to-Speech (TTS)

![Text to Voice](docs/screenshots/text-to-voice.png)

Every assistant answer can be read aloud. Automatically detects Urdu/Arabic script and picks the correct voice.

### 5. Visual Inspector

![Document Preview](docs/screenshots/doc-preview.png)

A side-by-side view of a PDF and its extracted structured blocks. Hover over a block to highlight it in the document.

---

## How the AI Chatbot Works

### Architecture

The backend follows a strict, one-directional Clean Architecture dependency flow:

**Controller (HTTP) ➞ Service (Business Logic) ➞ Repository (Data Access) ➞ Prisma ORM ➞ PostgreSQL**

- **Controllers** parse HTTP requests, set status codes, and format responses.
- **Services** contain all business logic and validation, with zero `req`/`res` dependencies.
- **Repositories** encapsulate every Prisma query.
- **Middlewares** handle auth (JWT), rate limiting, and file uploads.
- **DTOs** define the shape of incoming and outgoing data.

### Document Ingestion

When you upload a document via `POST /api/upload`, the backend walks through the following steps in order:

1. **LlamaParse (primary parser)** — The file is sent to LlamaCloud in JSON mode with `output_tables_as_markdown=true`. LlamaParse returns layout-aware blocks: each item has a `type` (text / heading / table), a `markdown` value, a block-level `bBox`, and a list of `layoutAwareBbox` entries (one per line). Page widths and heights are captured into a `pageDimensions` map keyed by page number.
   If the initial flag combination is rejected by the API tier, the code retries with progressively simpler flag sets (`json` only → `markdown` only). The last successful or failed response is written to `llama-debug.json` at the project root for inspection.
2. **Local `pdfjs` fallback** — If LlamaParse is unavailable or returns markdown-only output (no bounding boxes), the controller falls back to local `pdfjs-dist` parsing. It walks every page, records `pageDimensions`, and concatenates extracted strings into markdown. This path produces **no bounding boxes**, so the Visual Inspector won't highlight anything for documents ingested this way.
3. **OCR fallback for images** — For non-PDF, non-text uploads, Tesseract.js runs OCR to pull raw text out of the image.
4. **Text chunking** — If LlamaParse returned blocks, one chunk is created per block (each block's `markdown` or `plainValue` becomes a chunk). Otherwise, the `TextChunker` splits the raw markdown at sentence boundaries (`.` `!` `?`) into ~500-character chunks with no overlap. Isolated numbers and strings shorter than 5 characters are discarded as artifacts.
5. **Embeddings** — Each chunk is passed through `Xenova/all-MiniLM-L6-v2` running locally via `@xenova/transformers`. This produces a normalized 384-dimensional dense vector. No external API is called for embeddings.
6. **Persistence** — The `Document` row stores the full markdown plus `blocksJson` and `pageDimensionsJson` as TEXT columns. Each `DocumentChunk` row stores the content plus its `embedding` (JSON-stringified array).

### Retrieval (Query Time)

When a user sends a message to `POST /api/chat`, the `ChatController` runs the following:

1. **Embed the query** — The user's prompt goes through the same MiniLM model to produce a 384-dim query vector.
2. **Cosine similarity** — `SimilarityService.findSimilarChunks` loads up to 2000 chunks from the database (optionally scoped to one `documentId`), parses each stored embedding, and computes cosine similarity against the query vector. The chunks are sorted by score and the top `K` are returned (default `K = 3`; the voice controller bumps it up to `12` for "summarize / overview / key points" style prompts).
3. **Prompt assembly** — The `buildRagPrompt` helper wraps the retrieved chunks as a "RELEVANT DOCUMENT CONTEXT" section above the user's question. If no chunks were retrieved, the raw question is passed through unchanged.
4. **LLM call** — `LiveAIService` sends the assembled prompt (plus the last ~6 turns of conversation history for context) to Groq using `llama-3.3-70b-versatile` by default. If Groq fails, `RagController` transparently retries against OpenRouter's free Llama models before giving up.
5. **Response** — The assistant's reply is returned along with `languageUsed` and a `retrievedContextUsed` boolean so the frontend can show whether grounding was applied.

### Language Handling

Six languages are supported end-to-end: **English, Urdu, Spanish, French, German, and Mandarin Chinese**. The language code chosen in the UI flows through the whole pipeline:

- **Speech Recognition (browser)** — The `SpeechRecognition` API is initialized with the chosen BCP-47 code (e.g. `ur-PK`).
- **Speech-to-Text (server)** — `SttService` maps BCP-47 to Whisper's ISO-639-1 code (`ur-PK → ur`) before calling Groq's `whisper-large-v3-turbo`.
- **LLM prompt** — A directive like *"Reply ONLY in Urdu. Do not use English unless Urdu is English."* is appended to the system prompt.
- **Text-to-Speech** — `TtsService` runs a regex on the generated answer to detect Urdu/Arabic script (`\u0600-\u06FF`, `\u0750-\u077F`, etc.). If detected, it forces the `ur` gTTS voice regardless of what language the user selected. Otherwise it uses the mapped language. Long answers are split at sentence boundaries and then at clause boundaries, and each chunk is converted to MP3 and concatenated into a single file.
- **Browser TTS fallback** — When the server can't produce an MP3, the frontend falls back to `window.speechSynthesis` with the same Urdu-detection logic to pick a matching installed voice.

### Visual Inspector

The frontend `PdfComparator` component does its own PDF loading with `pdfjs-dist` at `RENDER_QUALITY = 2` (2× device pixel ratio) so highlighted regions stay sharp when zoomed. Because some print-ready PDFs draw their content rotated 90° while their metadata reports `rotation: 0`, the component compares the PDF's native aspect ratio against LlamaParse's reported `pageDimensions` for each page and picks a render rotation (0 / 90 / 180 / 270) that makes the canvas upright. Bounding boxes are then scaled by `pdfPageWidth / llamaPageWidth` so the highlights land on top of the correct text. Blocks that fail a sanity check (too tall, too big relative to the page, or negative dimensions) are clamped or skipped.

### Security

- **JWT auth** — `/auth/login` issues a JWT signed with `JWT_SECRET`. Protected routes verify it via the `authenticateToken` middleware and attach the decoded user to `req.user`.
- **Role-based access** — `authorizeRoles('ADMIN')` gates destructive endpoints (e.g. deleting students).
- **Rate limiting** — `express-rate-limit` throttles `/api/chat` and `/chat` to prevent abuse of the LLM key.
- **Password hashing** — `bcryptjs` with 10 salt rounds.
- **Zod validation** — Request bodies are validated against schemas before hitting service logic.
- **Centralized error handling** — Zod errors and malformed JSON bodies return 400 with a structured payload; anything else returns 500.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Backend | Node.js, Express, TypeScript |
| Structured data | PostgreSQL + Prisma ORM |
| PDF parsing | LlamaParse (LlamaCloud) + pdfjs-dist |
| Embeddings | Xenova Transformers (`all-MiniLM-L6-v2`, local, 384-dim) |
| Chat models | Groq (Llama 3.3 70B) with OpenRouter fallback |
| Voice (STT) | Groq Whisper (`whisper-large-v3-turbo`) |
| Voice (TTS) | `gTTS` (server MP3) + browser SpeechSynthesis |
| OCR | Tesseract.js |
| Frontend | React 19, Vite, TypeScript |
| Markdown | react-markdown, remark-gfm, remark-math, rehype-katex |
| Validation | Zod |
| Auth | JWT + bcryptjs |
| Rate limiting | express-rate-limit |

---

## Prerequisites

- **Node.js 22.13+** (required by `pdfjs-dist@6`)
- **PostgreSQL** (local or cloud — Neon/Supabase works)
- **Groq API key** — https://console.groq.com
- **LlamaCloud API key** — https://cloud.llamaindex.ai

---

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd internship-repo-1
npm install
```

### 2. Create the database

If using local PostgreSQL:

```bash
createdb ai_study_assistant
```

### 3. Create the `.env` file

Copy the template in the next section to a file named `.env` at the **project root** (same folder as `package.json`).

### 4. Initialize the database

```bash
npx prisma migrate dev
npx prisma db seed
```

### 5. Get external API keys

- **Groq**: sign up at https://console.groq.com → API Keys → Create
- **LlamaCloud**: sign up at https://cloud.llamaindex.ai → API Keys → Create

---

## Environment Variables

Place this file at the project root as `.env`:

```env
# Server
PORT=3000
JWT_SECRET=replace-with-a-long-random-string

# PostgreSQL (used by Prisma)
DATABASE_URL="postgresql://postgres:your-password@localhost:5432/ai_study_assistant?schema=public"

# Groq
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile

# LlamaCloud
LLAMA_CLOUD_API_KEY=llx-...

# Optional: OpenRouter fallback
OPENROUTER_API_KEY=sk-or-...
```

**Generating a JWT secret:**

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Running the App

Two terminals.

### Terminal 1 — Backend

```bash
npm run server
```

Expected output:

```
🚀 Server listening on http://localhost:3000
```

### Terminal 2 — Frontend

```bash
npm run dev
```

Expected output:

```
VITE ready
➜  Local:   http://localhost:5173/
```

### Open the app

Go to **http://localhost:5173** and start chatting or upload a document.

**Default seeded credentials:**

| Email | Password | Role |
| --- | --- | --- |
| `admin@cs.edu` | `admin123` | ADMIN |
| `student@cs.edu` | `user123` | USER |

---

## API Workflow

### Base URL

```
http://localhost:3000
```

### 1. Register

**POST** `/auth/register`

```json
{
  "email": "alice@cs.edu",
  "password": "Password123",
  "role": "USER"
}
```

### 2. Log in (to get a JWT)

**POST** `/auth/login`

```json
{
  "email": "student@cs.edu",
  "password": "user123"
}
```

Response:

```json
{
  "message": "Login successful!",
  "token": "eyJhbGciOi...",
  "user": { "id": 2, "email": "student@cs.edu", "role": "USER" }
}
```

Copy the `token` value. Use it as `Bearer <token>` in the `Authorization` header for all protected routes.

### 3. Upload a document

**POST** `/api/upload`

Form-data:

| Key | Type | Value |
| --- | --- | --- |
| `document` | File | your PDF / MD / TXT / image |

Response includes the `documentId`, `blocks`, `pageDimensions`, and generated `chunks` you'll use in the next step.

### 4. Inspect chunks (optional)

**GET** `/api/chunks?documentId=<id>`

Returns all chunks for that document with their content and index.

### 5. Visual comparison (optional)

**GET** `/api/documents/:id/comparison`

Returns `fileUrl`, `blocks`, and `pageDimensions` for the Visual Inspector UI.

### 6. Chat (no auth for React UI)

**POST** `/api/chat`

```json
{
  "studentId": 1,
  "prompt": "What is the adult dose of ceftaroline?",
  "language": "en-US",
  "documentId": 3,
  "history": [
    { "sender": "user", "text": "hi" },
    { "sender": "assistant", "text": "Hello!" }
  ]
}
```

Response:

```json
{
  "success": true,
  "reply": "...",
  "languageUsed": "English",
  "retrievedContextUsed": true
}
```

Omit `documentId` to search across all ingested documents.

### 7. Voice chat (multipart)

**POST** `/voice/chat`

| Key | Type | Value |
| --- | --- | --- |
| `audio` | File | WAV / MP3 / WebM |
| `language` | Text | `en-US`, `ur-PK`, … |
| `documentId` | Text | optional |

Response:

```json
{
  "success": true,
  "transcript": "what is the dose for adults",
  "answer": "...",
  "audioAnswerUrl": "http://localhost:3000/uploads/audio_answers/answer-...mp3",
  "citations": [ ... ]
}
```

### 8. Chat history

**GET** `/chat/history?studentId=1`

---

## Project Structure

Only the files below belong to the AI Study Assistant. **Anything else in the repo — standalone TypeScript exercises (`Task4-Mod2.ts`, `task6.ts`, `task7.ts`, etc.), the `dummyprettiercheck.html` file, early Express prototypes like `app.ts`, and the `Internship-Repo-1/` subfolder — is leftover from earlier internship tasks and is not part of this project.**

```text
src/                          Backend source
  app-db.ts                   Express app + route wiring
  config/
    db.ts                     PostgreSQL pool
    prompt.config.ts          System prompt + RAG prompt builder
  controllers/                HTTP request handlers
    auth.controller.ts
    student.controller.ts
    chat.controller.ts        RAG + history + preferences
    document.controller.ts    Upload, parse, chunk, embed
    rag.controller.ts         Conversational RAG with history
    voice.controller.ts       STT → RAG → TTS pipeline
  dtos/                       Data Transfer Objects
  middlewares/                Auth, rate limit, upload
  repositories/               Data access layer (Prisma)
    user.repository.ts
    student.repository.ts
    chat.repository.ts
  services/                   Business logic (zero req/res deps)
    auth.service.ts
    student.service.ts
    live-ai.service.ts        Groq wrapper with history
    ai-proxy.service.ts       Swap-in point for AI providers
    similarity.service.ts     Cosine similarity over embeddings
    embedding.service.ts      Xenova MiniLM (384-dim)
    stt.service.ts            Groq Whisper
    tts.service.ts            gTTS with Urdu detection
  utils/
    chunker.util.ts           Sentence-bounded chunker
  types/
    gtts.d.ts

src/components/               Frontend
  ChatUI.tsx                  Main app, 14 palettes, 6 languages
  PdfComparator.tsx           Visual Inspector window
  ComparisonPage.tsx          Standalone /?comparison=<id> page
  VisualComparator.tsx        Slider-based image comparator

Prisma/
  seed.ts                     Admin + student + courses seed
  migrations/                 Auto-generated Prisma migrations

uploads/                      Runtime file storage (PDFs, markdown, audio)
schema.sql                    PostgreSQL schema reference
llama-debug.json              Latest LlamaParse JSON dump (debugging)
```

---

## Prompt Engineering

The system prompt is intentionally **permissive** — the assistant answers any question (general knowledge, science, coding, casual), and only *uses* document context when it's relevant.

Full iteration log is in [`PROMPT_ITERATIONS.md`](./PROMPT_ITERATIONS.md).

### Iteration 1: Naive

```
You are a helpful assistant.
```

→ Generic answers, no formatting discipline.

### Iteration 2: Domain-scoped

```
You are an AI study assistant for university students. Answer CS and math questions.
```

→ Better context, but off-topic queries were answered and formatting lacked scannability.

### Iteration 3: Constrained & Grounded (current)

```
You are an intelligent, helpful, and articulate AI assistant.

You answer any question the user asks — general knowledge, science, math,
coding, casual conversation, opinions, current events, celebrities, geography,
history, and academic topics. You are NOT restricted to uploaded documents.

If the user has uploaded a document and the message includes RELEVANT DOCUMENT
CONTEXT below, use it to enrich your answer with grounded, specific facts.
When the context does not apply to the question, ignore it and answer from
your own knowledge as normal.

Rules:
- Never say "I do not have enough information from the documents" as a blanket refusal.
  If the context is irrelevant, just answer normally.
- Be concise, clear, and specific. Prefer short paragraphs or bullet points.
- Use markdown formatting when it improves readability (tables, code blocks, bold).
- If you genuinely don't know something, say so plainly — don't invent facts.
```

→ Clean structured responses, no hallucinated refusals, document context used only when relevant.

---

## Common Commands

| Command | Purpose |
| --- | --- |
| `npm run server` | Start backend with hot reload (`tsx`) |
| `npm run dev` | Start frontend Vite dev server |
| `npm run build` | Compile TypeScript + build frontend |
| `npm run preview` | Preview production frontend |
| `npx prisma migrate dev` | Apply pending migrations |
| `npx prisma studio` | Open Prisma DB browser |
| `npx prisma db seed` | Insert admin + student records |
| `npx tsx src/app-db.ts` | Run backend without hot reload |

---

## What You Must Improvise

If you're running this project on a fresh machine, these are the things that are **not** shipped with the code and must be set up by you.

### Required (the app will not run without these)

| Item | Why |
| --- | --- |
| **Node.js 22.13+** | `pdfjs-dist@6` requires it; older versions crash on startup |
| **PostgreSQL instance** | Local install or free cloud provider (Neon, Supabase) |
| **`.env` file at project root** | With all fields filled in (see Environment Variables) |
| **Your Postgres password in `.env`** | Must match your local Postgres setup |
| **Prisma migrate + seed** | Tables and seed records must exist |

### If you received the `.env` from the project author

These fields carry over as-is:

- `JWT_SECRET`
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `LLAMA_CLOUD_API_KEY`

These must be updated:

- `DATABASE_URL` — replace with your own Postgres credentials

### Optional (the app runs without these, degraded)

| Item | Behavior if missing |
| --- | --- |
| `GROQ_API_KEY` | Chat returns a "Groq API key is missing" message |
| `LLAMA_CLOUD_API_KEY` | Falls back to local `pdfjs` parsing (no bboxes, no table extraction, no multi-column layout awareness) |

### Common startup errors

**`Can't reach database server at localhost:5432`** — PostgreSQL isn't running, or the password in `.env` is wrong.

**`ERR_REQUIRE_ESM` on startup** — You're on Node < 22.13. Upgrade.

**`Port already in use`** — Something else is on 3000 or 5173. Kill it, or change `PORT` in `.env` and `vite.config.ts`.

**`LlamaParse: All flag variants failed`** — Your API tier doesn't support `output_tables_as_markdown`. Check `llama-debug.json` for the last response body.

---

## License

ISC
