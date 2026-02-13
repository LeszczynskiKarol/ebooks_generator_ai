# AI eBook Generator — Full Architecture & Implementation Plan

## Project Codename: **BookForge.ai**

---

## 1. Product Vision

A professional AI-powered eBook generator that takes a user from topic → paid structure → content generation → professional LaTeX typesetting → downloadable PDF & EPUB. Think "Canva meets LaTeX meets GPT" for book publishing.

**Key differentiators:**

- **Print-ready quality** — professional two-sided LaTeX typesetting, not cheap markdown-to-PDF
- **True book structure** — chapters, sections, TOC, title page, colophon, proper pagination
- **Image-aware** — AI contextually places user-uploaded or FLUX-generated images
- **Resumable workflow** — every stage persisted, users can pause and return
- **Multi-format output** — PDF (print-ready) + EPUB (digital readers)

---

## 2. Pricing Model

### Requirements

- Minimum: 99 PLN (≈ $25 USD) for ≤50 pages
- Maximum: 200 PLN (≈ $50 USD) for 150+ pages
- Smooth degressive curve between tiers

### Proposed Pricing Formula

```
Tier 1:  1–50 pages   →  99 PLN flat
Tier 2:  51–100 pages →  99 + (pages - 50) × 1.50 PLN
Tier 3:  101–150 pages → 174 + (pages - 100) × 0.52 PLN
Tier 4:  150+ pages   →  200 PLN flat (cap)
```

| Pages | Price (PLN) | Per Page | USD (~) |
| ----- | ----------- | -------- | ------- |
| 20    | 99          | 4.95     | $25     |
| 50    | 99          | 1.98     | $25     |
| 75    | 136         | 1.82     | $34     |
| 100   | 174         | 1.74     | $44     |
| 125   | 187         | 1.50     | $47     |
| 150   | 200         | 1.33     | $50     |
| 200   | 200         | 1.00     | $50     |
| 300   | 200         | 0.67     | $50     |

### Cost Analysis (Claude API)

- ~600 words/page × avg 1.5 tokens/word = ~900 tokens/page output
- With prompts, sources, structure: ~3,000 input + 900 output tokens/page
- Claude Sonnet 4.5: $3/1M input, $15/1M output
- **Cost per page: ~$0.009 input + $0.0135 output ≈ $0.023/page**
- 150-page book: ~$3.45 API cost → selling for $50 = **~93% margin**
- 50-page book: ~$1.15 API cost → selling for $25 = **~95% margin**

> Even with image generation (FLUX), scraping, and infrastructure, margins are excellent.

### USD Pricing Alternative (for global market)

Since targeting English-speaking global audience:

```
Tier 1:  1–50 pages   →  $24.99 flat
Tier 2:  51–100 pages →  $24.99 + (pages - 50) × $0.40
Tier 3:  101–150 pages → $44.99 + (pages - 100) × $0.10
Tier 4:  150+ pages   →  $49.99 flat (cap)
```

---

## 3. Tech Stack

### Frontend

| Layer       | Technology                                          |
| ----------- | --------------------------------------------------- |
| Framework   | **Vite + React 18 + TypeScript**                    |
| Routing     | **React Router v7**                                 |
| State       | **Zustand** (global) + React Query (server state)   |
| Styling     | **Tailwind CSS 4** + shadcn/ui components           |
| Forms       | **React Hook Form + Zod** (client-side validation)  |
| Payments    | **Stripe Elements** (embedded checkout)             |
| File upload | **react-dropzone** + presigned S3 URLs              |
| Editor      | **TipTap** or **BlockNote** (for structure editing) |
| i18n        | English-only for now, but structure for future i18n |

### Backend

| Layer       | Technology                                                      |
| ----------- | --------------------------------------------------------------- |
| Runtime     | **Node.js 22 LTS**                                              |
| Framework   | **Fastify 5** + @fastify/cors, @fastify/jwt, @fastify/multipart |
| Validation  | **Zod** (shared schemas frontend/backend)                       |
| ORM         | **Prisma 6**                                                    |
| Database    | **PostgreSQL 16**                                               |
| Queue       | **BullMQ + Redis** (job processing for generation)              |
| Auth        | **JWT** (access + refresh tokens) + Google OAuth                |
| Payments    | **Stripe SDK** (checkout sessions + webhooks)                   |
| AI          | **Anthropic SDK** (Claude Sonnet 4.5)                           |
| Storage     | **AWS S3** (images, generated files)                            |
| Email       | **AWS SES** (transactional emails)                              |
| Typesetting | **LaTeX (TeX Live)** + **Pandoc** (for EPUB)                    |

### Infrastructure

| Component        | Service                                                   |
| ---------------- | --------------------------------------------------------- |
| Frontend hosting | **Vercel** or **CloudFront + S3**                         |
| Backend          | **AWS EC2** or **ECS Fargate** (needs TeX Live installed) |
| Database         | **AWS RDS PostgreSQL**                                    |
| Queue/Cache      | **AWS ElastiCache Redis**                                 |
| File Storage     | **AWS S3**                                                |
| Image Gen        | **Self-hosted FLUX** (GPU instance)                       |
| CI/CD            | **GitHub Actions**                                        |
| Monitoring       | **Sentry** + CloudWatch                                   |

---

## 4. User Workflow (7 Stages)

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER WORKFLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  STAGE 1: BRIEF          → Topic, guidelines, page count        │
│     │                       Language, style preferences          │
│     ▼                                                            │
│  STAGE 2: PRICING        → See price, choose add-ons            │
│     │                       Optional: image generation pack      │
│     ▼                                                            │
│  STAGE 3: PAYMENT        → Stripe Checkout                      │
│     │                       Webhook confirms payment             │
│     ▼                                                            │
│  STAGE 4: STRUCTURE      → AI generates detailed TOC            │
│     │                       User can EDIT or REQUEST 1 REDO      │
│     ▼                                                            │
│  STAGE 5: IMAGES         → Upload own images OR                 │
│     │                       AI generates via FLUX                │
│     │                       AI suggests placement                │
│     ▼                                                            │
│  STAGE 6: GENERATION     → Multi-agent content generation       │
│     │                       Chapter by chapter with progress     │
│     │                       LaTeX compilation                    │
│     ▼                                                            │
│  STAGE 7: DELIVERY       → Preview PDF, download PDF + EPUB    │
│                             Rate & review                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

Each stage saves to DB. User can close browser and resume later.

---

## 5. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUTH
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String?  // null for OAuth users
  name          String?
  googleId      String?  @unique
  avatarUrl     String?

  stripeCustomerId String? @unique

  projects      Project[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROJECT (= one eBook)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

model Project {
  id            String        @id @default(cuid())
  userId        String
  user          User          @relation(fields: [userId], references: [id])

  // Stage tracking
  currentStage  ProjectStage  @default(BRIEF)

  // STAGE 1: Brief
  title         String?
  topic         String
  language      String        @default("en")  // en, pl, de, es, fr...
  guidelines    String?       @db.Text        // user instructions
  targetPages   Int                           // 10-300
  stylePreset   String        @default("modern") // modern, academic, minimal, creative

  // STAGE 2-3: Payment
  pricePln      Int?          // price in grosz (99.00 PLN = 9900)
  priceUsd      Int?          // price in cents ($24.99 = 2499)
  currency      String        @default("usd")
  stripeSessionId    String?
  stripePaymentId    String?
  paymentStatus      PaymentStatus @default(PENDING)
  paidAt             DateTime?

  // STAGE 4: Structure
  structure          ProjectStructure?
  structureRedoUsed  Boolean  @default(false)

  // STAGE 5: Images
  images             ProjectImage[]
  useAiImages        Boolean  @default(false)

  // STAGE 6: Generation
  chapters           Chapter[]
  generationStatus   GenerationStatus @default(NOT_STARTED)
  generationProgress Float     @default(0)  // 0.0 - 1.0

  // STAGE 7: Output
  outputPdfKey       String?   // S3 key
  outputEpubKey      String?   // S3 key
  outputPdfUrl       String?   // presigned URL (temporary)
  outputEpubUrl      String?   // presigned URL (temporary)

  // Metadata
  totalTokensUsed    Int       @default(0)
  totalCostUsd       Float     @default(0)

  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  @@index([userId])
  @@index([currentStage])
}

enum ProjectStage {
  BRIEF
  PRICING
  PAYMENT
  STRUCTURE
  STRUCTURE_REVIEW
  IMAGES
  GENERATING
  COMPILING
  COMPLETED
  ERROR
}

enum PaymentStatus {
  PENDING
  PAID
  FAILED
  REFUNDED
}

enum GenerationStatus {
  NOT_STARTED
  GENERATING_STRUCTURE
  STRUCTURE_READY
  GENERATING_CONTENT
  CONTENT_READY
  COMPILING_LATEX
  COMPILING_EPUB
  COMPLETED
  ERROR
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STRUCTURE (Table of Contents)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

model ProjectStructure {
  id            String   @id @default(cuid())
  projectId     String   @unique
  project       Project  @relation(fields: [projectId], references: [id])

  // The full structure as JSON
  // [{chapter: 1, title: "...", sections: [{title: "...", targetPages: 3, description: "..."}]}]
  structureJson String   @db.Text

  // AI prompts/responses for debugging
  generationPrompt   String? @db.Text
  generationResponse String? @db.Text

  // Version tracking (original vs user-edited vs AI-regenerated)
  version       Int      @default(1)
  isUserEdited  Boolean  @default(false)

  approvedAt    DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CHAPTERS (Generated Content)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

model Chapter {
  id            String   @id @default(cuid())
  projectId     String
  project       Project  @relation(fields: [projectId], references: [id])

  chapterNumber Int
  title         String

  // Content
  latexContent  String?  @db.Text   // Generated LaTeX code
  markdownDraft String?  @db.Text   // Intermediate markdown (before LaTeX)

  // Generation metadata
  targetPages   Int
  actualPages   Float?
  targetWords   Int       // ~600 words/page
  actualWords   Int?

  // Multi-agent tracking
  writerPrompts    String? @db.Text  // JSON array of prompts
  writerResponses  String? @db.Text  // JSON array of responses

  // Image placements for this chapter
  imagePlacements  ImagePlacement[]

  status        ChapterStatus @default(PENDING)

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([projectId, chapterNumber])
  @@index([projectId])
}

enum ChapterStatus {
  PENDING
  GENERATING
  GENERATED
  LATEX_READY
  ERROR
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// IMAGES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

model ProjectImage {
  id            String   @id @default(cuid())
  projectId     String
  project       Project  @relation(fields: [projectId], references: [id])

  // Source
  source        ImageSource
  originalName  String?
  s3Key         String
  s3Url         String?

  // AI analysis
  description   String?  @db.Text  // AI-generated description of the image
  suggestedContext String? @db.Text // AI suggestion for where to place it

  // Dimensions
  width         Int?
  height        Int?
  format        String?  // jpg, png, svg

  // FLUX generation metadata
  fluxPrompt    String?  @db.Text
  fluxSeed      Int?

  placements    ImagePlacement[]

  createdAt     DateTime @default(now())

  @@index([projectId])
}

enum ImageSource {
  USER_UPLOAD
  AI_GENERATED  // FLUX
  STOCK         // future: stock photo integration
}

model ImagePlacement {
  id            String   @id @default(cuid())
  chapterId     String
  chapter       Chapter  @relation(fields: [chapterId], references: [id])
  imageId       String
  image         ProjectImage @relation(fields: [imageId], references: [id])

  // Placement details
  position      String   // "after_section_2", "chapter_header", "inline_page_5"
  caption       String?
  width         Float    @default(0.8) // fraction of text width (0.0-1.0)

  createdAt     DateTime @default(now())

  @@index([chapterId])
}
```

---

## 6. Content Generation Pipeline

### Overview: Smart-Copy.ai Adapted for Books

Your Smart-Copy pipeline is excellent for articles. For books, we need modifications:

| Smart-Copy.ai                  | BookForge.ai                                |
| ------------------------------ | ------------------------------------------- |
| Single text, one topic         | Multi-chapter, coherent narrative           |
| Google search → scrape → write | User brief → structure → chapter-by-chapter |
| One prompt or manager+writers  | **Book Director** + **Chapter Writers**     |
| HTML output                    | **LaTeX output**                            |
| Max ~50k chars                 | Up to 200+ pages (~120k+ words)             |

### Generation Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   BOOK DIRECTOR (Claude)                  │
│  Reads: topic, guidelines, target pages                  │
│  Outputs: Detailed chapter-by-chapter structure           │
│           with page allocations and descriptions          │
└───────────────────────┬──────────────────────────────────┘
                        │
          ┌─────────────┼──────────────┐
          ▼             ▼              ▼
   ┌─────────────┐ ┌──────────┐ ┌──────────┐
   │ Chapter 1   │ │Chapter 2 │ │Chapter N │  ← Sequential generation
   │ Writer      │ │ Writer   │ │ Writer   │     (each gets context from
   │             │ │          │ │          │      previous chapters)
   └──────┬──────┘ └────┬─────┘ └────┬─────┘
          │             │             │
          ▼             ▼             ▼
   ┌─────────────┐ ┌──────────┐ ┌──────────┐
   │ LaTeX       │ │ LaTeX    │ │ LaTeX    │  ← Convert to LaTeX with
   │ Formatter   │ │Formatter │ │Formatter │     proper commands
   └──────┬──────┘ └────┬─────┘ └────┬─────┘
          │             │             │
          └─────────────┼─────────────┘
                        ▼
              ┌──────────────────┐
              │  Image Placer    │  ← Determines figure positions
              │  (Claude)        │     based on context + images
              └────────┬─────────┘
                       ▼
              ┌──────────────────┐
              │  LaTeX Compiler  │  ← pdflatex / xelatex
              │  + Pandoc        │     + pandoc for EPUB
              └────────┬─────────┘
                       ▼
                  PDF + EPUB
```

### Chapter Generation (adapted from Smart-Copy)

For each chapter:

1. **Research phase** (optional): Claude searches for relevant sources if topic needs facts
2. **Outline phase**: Chapter outline with section-level detail
3. **Writing phase**: Full prose generation, targeting ~600 words/page
4. **LaTeX conversion**: Convert structured content to LaTeX commands
5. **Image placement**: Insert `\begin{figure}` commands at optimal positions

### Key Differences from Smart-Copy

1. **Context window management**: Each chapter writer receives:
   - Book-level context (topic, guidelines, overall structure)
   - Summary of all previous chapters (to maintain coherence)
   - Last 2000 words of previous chapter (for flow continuity)
   - Chapter-specific brief (from Director)

2. **LaTeX output instead of HTML**: Writer generates LaTeX directly:

   ```latex
   \chapter{Introduction to Machine Learning}
   \label{ch:intro}

   Machine learning has transformed the way we approach...

   \section{Historical Context}
   \label{sec:history}

   The origins of machine learning can be traced back to...
   ```

3. **Page-aware writing**: Each writer targets specific word count based on page allocation, accounting for images, tables, and whitespace.

---

## 7. LaTeX Architecture

### Why LaTeX over Quarto?

| Aspect             | LaTeX             | Quarto                  |
| ------------------ | ----------------- | ----------------------- |
| Print quality      | ★★★★★             | ★★★☆☆                   |
| Two-sided layout   | Native            | Limited                 |
| Typography control | Total             | Partial                 |
| PDF output         | Native (pdflatex) | Via LaTeX anyway        |
| EPUB output        | Via pandoc        | Native                  |
| AI generation ease | Moderate          | Easier (markdown-based) |
| Learning curve     | Steep             | Gentle                  |

**Recommendation: LaTeX for PDF + Pandoc for EPUB**

The AI generates LaTeX. For EPUB, we run a pandoc conversion from the LaTeX source (or from an intermediate markdown). This gives us the best of both worlds: professional PDF and functional EPUB.

### LaTeX Document Template

```latex
% ═══════════════════════════════════════════
% BookForge.ai — Professional eBook Template
% ═══════════════════════════════════════════
\documentclass[
  11pt,
  a5paper,              % Standard eBook size (or b5paper, letterpaper)
  twoside,              % Two-sided for print-ready
  openright,            % Chapters start on right pages
  final
]{book}

% ── Geometry ──
\usepackage[
  inner=20mm,           % Inner margin (binding side)
  outer=15mm,           % Outer margin
  top=20mm,
  bottom=25mm,
  footskip=12mm
]{geometry}

% ── Typography ──
\usepackage{fontspec}              % XeLaTeX font support
\usepackage{microtype}             % Microtypography
\usepackage{setspace}              % Line spacing
\setmainfont{TeX Gyre Pagella}     % Professional serif font
\setsansfont{TeX Gyre Heros}       % Sans-serif for headings
\setmonofont{Fira Code}[Scale=0.85]

% ── Chapter styling ──
\usepackage{titlesec}
\titleformat{\chapter}[display]
  {\normalfont\huge\bfseries\sffamily}
  {\chaptertitlename\ \thechapter}{20pt}{\Huge}
\titlespacing*{\chapter}{0pt}{-30pt}{40pt}

% ── Headers & Footers ──
\usepackage{fancyhdr}
\pagestyle{fancy}
\fancyhf{}
\fancyhead[LE]{\small\textit{\leftmark}}    % Left page: chapter name
\fancyhead[RO]{\small\textit{\rightmark}}   % Right page: section name
\fancyfoot[LE,RO]{\small\thepage}           % Page numbers outside
\renewcommand{\headrulewidth}{0.4pt}

% ── Images ──
\usepackage{graphicx}
\usepackage{float}
\usepackage{wrapfig}
\usepackage{caption}
\captionsetup{
  font=small,
  labelfont=bf,
  format=hang,
  margin=10pt
}

% ── Tables ──
\usepackage{booktabs}
\usepackage{tabularx}
\usepackage{longtable}

% ── Code listings ──
\usepackage{listings}
\usepackage{xcolor}

% ── Hyperlinks ──
\usepackage{hyperref}
\hypersetup{
  colorlinks=true,
  linkcolor=black,
  urlcolor=blue!60!black,
  citecolor=green!40!black,
  pdfauthor={BookForge.ai},
}

% ── Other ──
\usepackage{enumitem}
\usepackage{amsmath}
\usepackage{bookmark}

% ═══════════════════════════════════════════
\begin{document}

% ── FRONT MATTER ──
\frontmatter

% Title page (generated per-project)
\input{chapters/titlepage}

% Copyright / colophon
\input{chapters/colophon}

% Table of Contents
\tableofcontents

% ── MAIN MATTER ──
\mainmatter

\input{chapters/chapter01}
\input{chapters/chapter02}
% ... dynamically generated

% ── BACK MATTER ──
\backmatter

% Optional: bibliography, index, appendices
\input{chapters/bibliography}

\end{document}
```

### Server-Side Compilation

```bash
# Install TeX Live on the server (Dockerfile)
RUN apt-get update && apt-get install -y \
    texlive-full \
    texlive-fonts-extra \
    texlive-xetex \
    pandoc \
    && rm -rf /var/lib/apt/lists/*

# Compilation pipeline
xelatex -interaction=nonstopmode -output-directory=output main.tex
xelatex -interaction=nonstopmode -output-directory=output main.tex  # 2nd pass for TOC
xelatex -interaction=nonstopmode -output-directory=output main.tex  # 3rd pass for refs

# EPUB conversion
pandoc main.tex -o output/book.epub \
  --epub-cover-image=cover.png \
  --toc \
  --toc-depth=2
```

---

## 8. API Endpoints

### Auth

```
POST   /api/auth/register          → { email, password, name }
POST   /api/auth/login             → { email, password } → JWT
POST   /api/auth/google            → { googleToken } → JWT
POST   /api/auth/refresh           → { refreshToken } → new JWT
GET    /api/auth/me                → user profile
```

### Projects

```
POST   /api/projects               → Create project (stage: BRIEF)
GET    /api/projects               → List user's projects
GET    /api/projects/:id           → Get project details + current stage
PATCH  /api/projects/:id/brief     → Update topic/guidelines/pages
DELETE /api/projects/:id           → Delete project (if not paid)
```

### Payment

```
POST   /api/projects/:id/checkout  → Create Stripe session → redirect URL
POST   /api/webhooks/stripe        → Stripe webhook (payment confirmed)
GET    /api/projects/:id/payment   → Check payment status
```

### Structure

```
POST   /api/projects/:id/structure/generate  → AI generates TOC
GET    /api/projects/:id/structure            → Get current structure
PUT    /api/projects/:id/structure            → User edits structure
POST   /api/projects/:id/structure/redo       → AI regenerates (one-time)
POST   /api/projects/:id/structure/approve    → Lock structure, advance stage
```

### Images

```
POST   /api/projects/:id/images/upload       → Upload image → S3
POST   /api/projects/:id/images/generate     → Generate via FLUX
DELETE /api/projects/:id/images/:imageId     → Remove image
POST   /api/projects/:id/images/auto-place   → AI suggests placements
POST   /api/projects/:id/images/finalize     → Confirm placements, advance
```

### Generation

```
POST   /api/projects/:id/generate            → Start content generation
GET    /api/projects/:id/generation/status    → Poll progress (SSE/WebSocket)
GET    /api/projects/:id/chapters/:num        → Get chapter content
```

### Output

```
GET    /api/projects/:id/preview              → Preview first 5 pages (PDF)
GET    /api/projects/:id/download/pdf         → Download full PDF
GET    /api/projects/:id/download/epub        → Download EPUB
```

---

## 9. Frontend Pages

```
/                          → Landing page (marketing, SEO)
/pricing                   → Pricing calculator
/auth/login                → Login
/auth/register             → Register
/auth/callback/google      → OAuth callback

/dashboard                 → User's projects list
/projects/new              → New project wizard (Stage 1: Brief)
/projects/:id              → Project detail / current stage
/projects/:id/structure    → Structure editor (Stage 4)
/projects/:id/images       → Image manager (Stage 5)
/projects/:id/progress     → Generation progress (Stage 6)
/projects/:id/preview      → PDF preview + downloads (Stage 7)
```

### Landing Page Structure

```
Hero: "Create Professional eBooks with AI in Minutes"
  ├── Animated demo / video
  ├── CTA: "Start Your Book →"

How It Works (3-step visual):
  ├── 1. Describe Your Book
  ├── 2. Review & Customize Structure
  ├── 3. Download Print-Ready PDF + EPUB

Features:
  ├── Professional LaTeX Typesetting
  ├── AI-Powered Content Generation
  ├── Smart Image Placement
  ├── Multi-Format Output

Pricing Calculator (interactive):
  ├── Slider: page count → price

Sample Books (PDF previews):
  ├── Business / Marketing
  ├── Technical / Educational
  ├── Creative / Fiction

FAQ + Footer
```

---

## 10. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

**Goal: Monorepo setup, auth, basic UI**

```
bookforge/
├── packages/
│   └── shared/              ← Shared Zod schemas, types
│       ├── src/
│       │   ├── schemas/     ← Zod validation schemas
│       │   └── types/       ← TypeScript types
│       └── package.json
├── apps/
│   ├── web/                 ← Vite + React frontend
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── stores/      ← Zustand stores
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   └── App.tsx
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   └── api/                 ← Fastify backend
│       ├── src/
│       │   ├── routes/
│       │   ├── services/
│       │   ├── middleware/
│       │   ├── lib/
│       │   └── server.ts
│       ├── prisma/
│       │   └── schema.prisma
│       └── package.json
├── infra/
│   ├── docker/
│   │   ├── Dockerfile.api
│   │   └── Dockerfile.worker
│   └── latex/
│       └── templates/       ← LaTeX templates
├── turbo.json
├── package.json
└── pnpm-workspace.yaml
```

**Deliverables:**

- [ ] Monorepo with pnpm workspaces + Turborepo
- [ ] Prisma schema + migrations
- [ ] JWT auth (register/login/Google OAuth)
- [ ] Basic dashboard UI
- [ ] Landing page

### Phase 2: Payment + Structure (Week 2-3)

**Goal: Complete Stages 1-4**

**Deliverables:**

- [ ] Project creation form (brief)
- [ ] Pricing calculator (interactive)
- [ ] Stripe Checkout integration
- [ ] Webhook handling
- [ ] AI structure generation (Claude)
- [ ] Structure editor (editable tree)
- [ ] One-time structure regeneration

### Phase 3: Content Generation (Week 3-5)

**Goal: Multi-chapter AI generation pipeline**

**Deliverables:**

- [ ] BullMQ job queue setup
- [ ] Book Director agent (structure → chapter briefs)
- [ ] Chapter Writer agent (chapter-by-chapter content)
- [ ] LaTeX formatter agent (content → LaTeX)
- [ ] Progress tracking (SSE or WebSocket)
- [ ] Chapter preview

### Phase 4: Images + Compilation (Week 5-6)

**Goal: Complete pipeline from content to PDF/EPUB**

**Deliverables:**

- [ ] Image upload to S3
- [ ] AI image analysis + placement suggestions
- [ ] FLUX integration (image generation)
- [ ] LaTeX compilation on server
- [ ] Pandoc EPUB conversion
- [ ] PDF preview + download
- [ ] EPUB download

### Phase 5: Polish + Launch (Week 6-8)

**Goal: Production-ready**

**Deliverables:**

- [ ] Error handling + retry logic
- [ ] Email notifications (generation complete)
- [ ] SEO optimization (landing page, meta tags, sitemap)
- [ ] Performance optimization
- [ ] Monitoring (Sentry, logging)
- [ ] Documentation
- [ ] Beta testing
- [ ] Launch

---

## 11. Key Technical Decisions

### LaTeX vs Quarto Decision

**Go with LaTeX for PDF generation.** Reasoning:

- You already know LaTeX well
- Print-ready quality with two-sided layout is native to LaTeX
- Full control over typography, headers, margins
- For EPUB: convert LaTeX → EPUB via pandoc (proven pipeline)
- Quarto adds unnecessary abstraction layer

### Content Generation Strategy

**Sequential chapter generation** (not parallel). Reasoning:

- Each chapter needs context from previous ones for coherence
- Parallel generation leads to inconsistencies, repetition
- Sequential is slower but quality is dramatically better
- Can still parallelize LaTeX formatting after all content is generated

### Image Strategy

1. **User uploads** → AI analyzes with Claude Vision → suggests chapter/section placement
2. **AI generation** → Claude writes FLUX prompt per chapter → FLUX generates → same placement logic
3. **Fallback** → If no images, generate decorative chapter headers + pull-quotes as visual elements

### Page Count Accuracy

LaTeX page count depends on: font size, margins, images, whitespace. Strategy:

- Target ~600 words/page for A5 format with current template
- After first compilation: check actual page count
- If off by >10%: adjust content (add/remove paragraphs)
- Iterative: compile → check → adjust → recompile (max 3 iterations)

---

## 12. SEO Strategy (Global English)

### Target Keywords

- "ai ebook generator"
- "create ebook with ai"
- "ai book creator"
- "professional ebook maker"
- "latex ebook generator"
- "ai write book pdf"
- "generate ebook from topic"

### Technical SEO

- SSR/SSG for landing page (consider Next.js just for landing, or Astro)
- Or: Vite + react-helmet-async + prerender for critical pages
- Structured data (JSON-LD) for SoftwareApplication
- sitemap.xml, robots.txt
- Core Web Vitals optimization
- Blog section (programmatic SEO: "How to create an ebook about [topic]")

### Content Marketing

- Sample books as lead magnets
- "Create Your First eBook in 5 Minutes" video/tutorial
- Comparison pages: "BookForge vs [competitor]"
- Blog: AI writing tips, LaTeX typography, self-publishing guides

---

## 13. Starting Point — What to Build First

### Recommended First Session: Project Scaffolding + Auth + Landing Page

1. **Initialize monorepo** (pnpm + turborepo)
2. **Prisma schema** (Users + Projects — core tables only)
3. **Fastify server** with auth routes
4. **Vite React app** with routing + Zustand
5. **Landing page** (professional, SEO-optimized)
6. **Auth pages** (login/register)
7. **Dashboard** (empty state → "Create your first book")
8. **Project creation form** (Stage 1: Brief)

This gives us a working skeleton that we can demo and iterate on.

---

## 14. Risk Assessment

| Risk                                    | Impact | Mitigation                                                    |
| --------------------------------------- | ------ | ------------------------------------------------------------- |
| LaTeX compilation fails                 | High   | Sandbox compilation, error recovery, fallback template        |
| Content too short/long for target pages | Medium | Iterative compile-and-adjust loop                             |
| Claude generates poor LaTeX             | Medium | Post-processing validator, common error fixes                 |
| FLUX unavailable/slow                   | Low    | Fallback to decorative elements, stock photos                 |
| Stripe webhook missed                   | Medium | Idempotent handlers, periodic reconciliation                  |
| Long generation time (150+ pages)       | Medium | Background queue, progress notifications, email on completion |
| User abandons mid-flow                  | Low    | All stages persisted, resume anytime                          |

---

_Document version: 1.0 — Created for BookForge.ai project initialization_
