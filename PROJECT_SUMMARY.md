# USMLE Question Generation Platform — Project Summary

> **Last updated**: 2025-01-16  
> **Project scope**: Backend development for an AI-powered USMLE question generation platform, leveraging RAG (Retrieval-Augmented Generation) with ChromaDB and OpenRouter LLMs.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Active Development Phases](#2-active-development-phases)
3. [Technical Stack](#3-technical-stack)
4. [Architecture Decisions](#4-architecture-decisions)
5. [File Inventory](#5-file-inventory)
   - [Created Files](#created-files)
   - [Modified Files](#modified-files)
   - [Referenced/Examined Files](#referencedexamined-files)
6. [Solutions & Troubleshooting](#6-solutions--troubleshooting)
7. [Outstanding Work & Next Steps](#7-outstanding-work--next-steps)
8. [Appendix: Key Scripts & Commands](#8-appendix-key-scripts--commands)

---

## 1. Overview

This project is a **NestJS 11 backend** for generating USMLE-style questions using AI. The system:

- **Ingests medical knowledge** from existing question markdown files (658 buzzword + 346 vignette files) into a vector database (ChromaDB).
- **Retrieves relevant context** from the vector store when a user requests a new question.
- **Generates questions** via OpenRouter LLM (`deepseek/deepseek-v4-flash`) using RAG patterns, producing questions in the exact JSON format expected by the frontend's `importQuestions()` method.
- **Stores generated questions** in PostgreSQL (via Prisma) with `isPublished: false`, `reviewed: false`, `source: 'AI_GENERATED'`.

The system is designed to **prevent reproducing existing questions** by stripping Q&A pairs from ingested knowledge chunks, ensuring the LLM only receives medical concepts and patterns — not the original questions themselves.

---

## 2. Active Development Phases

### Phase 1: RAG-Based Question Generation ✅

**Status**: Implemented and ready for testing.

**Key work**:
- Created DTOs (`GenerateBuzzwordQuestionDto`, `GenerateVignetteQuestionDto`, `QuestionGenerationResponse`)
- Wrote RAG prompts for buzzword and vignette question generation
- Modified `QuestionGenerationService` to:
  - Query ChromaDB for relevant context based on user-selected topic/system/discipline
  - Build a prompt with retrieved knowledge chunks
  - Call the LLM to generate a new question
  - Parse the LLM response and save the question to the database via Prisma
- Extended `LLMService` (OpenRouter provider) for RAG integration
- Generated questions are saved with `source: 'AI_GENERATED'`, `isPublished: false`, `reviewed: false`

**Endpoint**: `POST /questions/generate` with `sourceType: 'BUZZWORD' | 'VIGNETTE'`

### Phase 2: Markdown Document Ingestion Pipeline ✅

**Status**: Implemented and executed successfully.

**Key work**:
- Built a standalone NestJS ingestion script (`src/scripts/ingest-markdown.ts`)
- Parses 658 buzzword + 346 vignette markdown files, extracting knowledge-bearing sections
- Strips Q&A sections to prevent the LLM from reproducing existing questions
- Chunks content semantically (1 chunk per file for buzzwords; 1 clinical presentation chunk per vignette)
- Embeds and stores chunks in ChromaDB (`Usmle_knowledge_bank` collection)
- **Result**: 1,004 chunks successfully ingested with 0 failures

#### Chunking Strategy

| Source | Files | Chunks per File | Total Chunks | Content |
|--------|-------|-----------------|--------------|---------|
| Buzzword | 658 | 1 | 658 | Topic, system, discipline, buzzwords, patterns, explanations, related concepts |
| Vignette | 346 | 1 | 346 | Clinical presentation, symptoms, labs, vitals, physical exam, main clue, supporting clue |

**Excluded sections** (to prevent question reproduction):
- Buzzword files: `## Buzzword Question`, `## Answer Options`, `## Correct Answer`, `## Wrong Options`
- Vignette files: `## Question`, `## Correct Answer`, `## Wrong Options`

---

## 3. Technical Stack

| Category | Technology |
|----------|------------|
| **Runtime** | Node.js, NestJS 11 |
| **Language** | TypeScript 5.7 (decorators, `nodenext` module resolution) |
| **Database** | PostgreSQL (Neon, AWS ap-southeast-1) via Prisma |
| **Vector DB** | Chroma Cloud (`Usmle_knowledge_bank` collection, cosine similarity) |
| **LLM (Chat)** | OpenRouter — `deepseek/deepseek-v4-flash` |
| **Embeddings** | OpenRouter — `openai/text-embedding-3-small` (1536 dimensions) |
| **File storage** | Local markdown files in `scripts/output_buzzword_markdown/` and `scripts/output_markdown_vqv/` |
| **Script runner** | `ts-node` with `tsconfig-paths/register` |
| **Key libraries** | `chromadb` (CloudClient), `@nestjs/core`, `@openrouter/sdk`, `axios`, `prisma` |

---

## 4. Architecture Decisions

### Ingestion Pipeline

- **Standalone script pattern** (not a CLI command module) — simpler to develop and run independently.
- **Uses `NestFactory.createApplicationContext()`** to bootstrap NestJS DI without starting the HTTP server.
- **Leverages existing `ChromaService.addDocuments()`** which internally calls `EmbeddingService.embedBatch()` — no need to manage embeddings in the script.
- **Batch size of 20** to balance API throughput with OpenRouter rate limits.
- **Unique document IDs** generated from: `{sourceType}_{index padded to 4 digits}_{sanitized topic}_{optional chunkType}`.
- **Rich metadata** attached to each chunk: `topic`, `sourceType` (BUZZWORD/VIGNETTE), `chunkType`, `system`, `discipline`, `difficulty`, `cognitiveLevel`, `trapType`, boolean flags for vitals/labs/exam.

### Knowledge Extraction

- **Section-based markdown parsing** using regex on `##` headings.
- **Metadata table parsing** extracts key-value pairs from the `## Metadata` section.
- **Answer stripping** — vignette text may contain inline answer options (e.g., "A. Degeneration of orexin-producing neurons..."). These are stripped using regex: `^[A-E]\)\s.*` or `^[A-E]\.\s.*`.

### RAG Question Generation

- **Context retrieval** from ChromaDB based on user-selected `topic`, `system`, `discipline` (via metadata filtering).
- **Prompt construction** with retrieved knowledge chunks as context.
- **JSON response parsing** — LLM returns structured JSON matching the existing question format.
- **Database persistence** — generated questions saved via Prisma, available for review in the dashboard.

---

## 5. File Inventory

### Created Files

| File | Purpose |
|------|---------|
| `src/scripts/ingest-markdown.ts` | Main ingestion script — reads markdown files, parses sections, creates chunks, embeds, and stores in ChromaDB |
| *(DTOs and prompt files from Phase 1)* | Supporting files for RAG question generation |

### Modified Files

| File | Change |
|------|--------|
| `package.json` | Added `"ingest:markdown": "npx ts-node -r tsconfig-paths/register src/scripts/ingest-markdown.ts"` script |
| `src/questions/question-generation.service.ts` | Rewritten for RAG-based generation with ChromaDB context retrieval |
| `src/llm/providers/openrouter.provider.ts` | Extended to support RAG prompt patterns |

### Referenced/Examined Files (No Changes)

| File | Purpose |
|------|---------|
| `src/chroma/chroma.service.ts` | `addDocuments()` for ingestion, `query()` for RAG retrieval |
| `src/chroma/chroma-client.ts` | Chroma Cloud connection config (tenant, database, collection) |
| `src/embeddings/embedding.service.ts` | `embedBatch()` — wraps OpenRouter embedding API |
| `scripts/output_buzzword_markdown/` | 658 buzzword markdown files (1 question per file) |
| `scripts/output_markdown_vqv/` | 346 vignette markdown files (1 question per file) |
| `scripts/buzz2Md.js` | Original script converting Excel to buzzword markdown |
| `scripts/vignette2Md.js` | Original script converting Excel to vignette markdown |
| `src/llm/prompts/rag-question.prompt.ts` | Prompts for buzzword/vignette question generation |

---

## 6. Solutions & Troubleshooting

### Problem 1: Vignette teaching chunks not created

- **Observation**: The `buildVignetteChunks` function was designed to create a second "Teaching Points" chunk from `## Explanation`, `## Step-by-Step Reasoning`, `## Educational Objective`, and `## Related Concepts` sections. However, the vignette markdown files (`output_markdown_vqv/`) do not contain any of these sections.
- **Resolution**: The script correctly handles this — it only creates the teaching chunk when those sections exist. The result was 346 chunks from 346 vignette files (1 clinical presentation chunk each), which is correct behavior.

### Problem 2: ChromaDB connection timeout / retry handling

- **Observation**: The `ChromaClientProvider` has built-in exponential backoff retry logic (3 attempts, 1s initial delay, doubling each time).
- **Resolution**: No changes needed — the existing connection handling worked correctly during the ingestion run.

### Problem 3: Vignette text contains inline answer options

- **Observation**: The `## Vignette` section in some files includes answer options inline (e.g., "A. Degeneration of orexin-producing neurons... \nB. Obstruction of the upper airway...") that needed to be stripped.
- **Resolution**: The `buildVignetteChunks` function uses a regex to strip lines matching `^[A-E]\)\s.*` or `^[A-E]\.\s.*` from the vignette text before storing it as knowledge.

### Problem 4: RN/Dot notation in metadata values

- **Observation**: Some metadata values contain RN (Registered Nurse) or dot notation (e.g., "RN.BSN") that could interfere with parsing.
- **Resolution**: The metadata table parser handles these correctly by treating them as plain text values.

---

## 7. Outstanding Work & Next Steps

### Complete ✅

- [x] RAG-based question generation (DTOs, prompts, service, LLM integration)
- [x] Markdown ingestion pipeline (script, parsing, chunking, embedding, storage)
- [x] Successfully ingested 1,004 chunks (658 buzzword + 346 vignette) into ChromaDB

### Potential Next Steps

1. **🔁 Dedup / Fresh Ingestion**
   - The current script generates unique IDs per file but does not check for existing documents. Re-running will add duplicates. If a fresh ingestion is needed, the ChromaDB collection should be deleted first, or a dedup check added to the script.

2. **🧪 End-to-End Validation**
   - Test the RAG generation endpoint (`POST /questions/generate`) with both `sourceType: 'BUZZWORD'` and `sourceType: 'VIGNETTE'` using the newly ingested ChromaDB content.
   - Verify that the LLM generates **new** questions based on the knowledge chunks (not reproduces existing ones).

3. **📊 Token Usage Return**
   - The `generateWithPrompt()` method logs token usage but does not return it to the caller. The `question-generation.service.ts` currently returns `tokenUsage: undefined`. This should be wired up for frontend display.

4. **👀 Review Workflow Integration**
   - Generated questions with `isPublished: false`, `reviewed: false` need to be visible in the review dashboard.

5. **📄 Ingestion of Additional Markdown Sources**
   - The script is designed to be extensible. If new markdown directories are added in the future, the script can be updated to process them with the same pattern.

---

## 8. Appendix: Key Scripts & Commands

### Ingestion

```bash
# Run the markdown ingestion pipeline
npm run ingest:markdown
```

### Development

```bash
# Start the NestJS development server
npm run start:dev
```

### Database

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# View database in Prisma Studio
npx prisma studio
```

### Ingestion Script Details (`src/scripts/ingest-markdown.ts`)

| Aspect | Detail |
|--------|--------|
| **Buzzword directory** | `scripts/output_buzzword_markdown/` |
| **Vignette directory** | `scripts/output_markdown_vqv/` |
| **Batch size** | 20 chunks per API call |
| **Document ID format** | `{sourceType}_{index}_{topic}_{chunkType}` |
| **ChromaDB collection** | `Usmle_knowledge_bank` |
| **Embedding model** | `openai/text-embedding-3-small` (1536 dimensions) |
| **Distance metric** | Cosine similarity |

---

*This summary covers the project state as of the latest conversation. For detailed implementation specifics, refer to the individual source files listed above.*