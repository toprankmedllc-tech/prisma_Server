/**
 * Ingest Markdown Files into ChromaDB
 * =====================================
 *
 * This script reads markdown files from the buzzword and vignette directories,
 * extracts knowledge-bearing sections (excluding Q&A pairs), chunks them
 * semantically, and ingests them into ChromaDB for RAG-based question generation.
 *
 * Usage:
 *   npm run ingest:markdown
 *
 * The script will:
 *   - Read all .md files from scripts/output_buzzword_markdown/ and scripts/output_markdown_vqv/
 *   - Parse sections by ## headers
 *   - Extract knowledge content (skip questions, answers, wrong options)
 *   - For buzzwords: 1 chunk per file (knowledge + buzzword patterns)
 *   - For vignettes: 2 chunks per file (clinical presentation + teaching points)
 *   - Embed and store in ChromaDB with rich metadata
 */

import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { ChromaService } from '../chroma/chroma.service';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// Types
// ============================================

interface ParsedSection {
    heading: string;
    content: string;
}

interface MarkdownChunk {
    id: string;
    content: string;
    metadata: Record<string, any>;
}

// ============================================
// Configuration
// ============================================

const BUZZWORD_DIR = path.resolve(__dirname, '../../scripts/output_buzzword_markdown');
const VIGNETTE_DIR = path.resolve(__dirname, '../../scripts/output_markdown_vqv');

const logger = new Logger('IngestMarkdown');

// ============================================
// SECTION PARSING
// ============================================

/**
 * Parse a markdown file into sections by splitting on ## headings.
 * Returns the topic (from # heading) and an array of sections.
 */
function parseMarkdownSections(fileContent: string): { topic: string; sections: ParsedSection[] } {
    // Extract the topic from the # heading at the top
    const topicMatch = fileContent.match(/^#\s+(.+)/m);
    const topic = topicMatch ? topicMatch[1].trim() : 'Unknown';

    // Split on ## headings
    const sectionRegex = /^##\s+(.+)$/gm;
    const sections: ParsedSection[] = [];

    let lastIndex = 0;
    let lastHeading = '';

    // Find all headings and their positions
    const headingMatches: { heading: string; index: number }[] = [];
    let match: RegExpExecArray | null;

    while ((match = sectionRegex.exec(fileContent)) !== null) {
        headingMatches.push({
            heading: match[1].trim(),
            index: match.index,
        });
    }

    // Extract content between headings
    for (let i = 0; i < headingMatches.length; i++) {
        const start = headingMatches[i].index;
        const end = i + 1 < headingMatches.length ? headingMatches[i + 1].index : fileContent.length;

        const headingText = headingMatches[i].heading;
        // The content after the heading line
        const contentAfterHeading = fileContent.substring(start + headingText.length + 4, end).trim();
        // +4 accounts for '## ' and the newline

        sections.push({
            heading: headingText,
            content: contentAfterHeading,
        });
    }

    return { topic, sections };
}

/**
 * Extract metadata from the ## Metadata table.
 */
function parseMetadataTable(content: string): Record<string, string> {
    const metadata: Record<string, string> = {};

    // Match table rows: | Key | Value |
    const rowRegex = /^\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|/gm;
    let match: RegExpExecArray | null;

    while ((match = rowRegex.exec(content)) !== null) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (key && key !== 'Field' && key !== '-------') {
            // Normalize key
            const normalizedKey = key
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_|_$/g, '');
            metadata[normalizedKey] = value;
        }
    }

    return metadata;
}

/**
 * Extract difficulty from metadata (handles various formats like "2", "3 (Medium)", "4")
 */
function extractDifficulty(metadata: Record<string, string>): string {
    const diffStr = metadata['difficulty'] || '';
    if (diffStr.includes('1') || diffStr.toUpperCase().includes('EASY')) return 'EASY';
    if (diffStr.includes('3') || diffStr.includes('4') || diffStr.includes('5') || diffStr.toUpperCase().includes('HARD')) return 'HARD';
    return 'MEDIUM';
}

// ============================================
// CHUNK BUILDERS
// ============================================

/**
 * Build a knowledge chunk for a buzzword file.
 * Includes: metadata, buzzwords, buzzword combos, explanations, related concepts.
 * Excludes: the question itself, answer options, correct answer, wrong options.
 */
function buildBuzzwordChunk(
    topic: string,
    sections: ParsedSection[],
    metadata: Record<string, string>,
    index: number,
): MarkdownChunk {
    const sectionMap = new Map(sections.map((s) => [s.heading, s.content]));

    // Extract knowledge content
    const buzzwords = sectionMap.get('Buzzwords Used') || '';
    const buzzwordComboCorrect = sectionMap.get('Buzzword Combination (Correct)') || '';
    const explanation = sectionMap.get('Explanation') || '';
    const relatedConcepts = sectionMap.get('Related Concepts') || '';
    const tags = sectionMap.get('Tags') || '';

    // Build the knowledge content (NOT the question)
    const contentParts: string[] = [];

    contentParts.push(`Topic: ${topic}`);
    contentParts.push(`System: ${metadata['system'] || 'N/A'}`);
    contentParts.push(`Discipline: ${metadata['discipline'] || 'N/A'}`);

    if (buzzwords) {
        contentParts.push(`\nKey Buzzwords:\n${buzzwords}`);
    }

    if (buzzwordComboCorrect) {
        contentParts.push(`\nBuzzword Pattern:\n${buzzwordComboCorrect}`);
    }

    if (explanation) {
        contentParts.push(`\nMedical Explanation:\n${explanation}`);
    }

    if (relatedConcepts) {
        contentParts.push(`\nRelated Concepts:\n${relatedConcepts}`);
    }

    if (tags) {
        contentParts.push(`\nTags:\n${tags}`);
    }

    const content = contentParts.join('\n');

    return {
        id: `buzzword_${String(index).padStart(4, '0')}_${topic.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').substring(0, 50)}`,
        content,
        metadata: {
            topic,
            sourceType: 'BUZZWORD',
            system: metadata['system'] || null,
            discipline: metadata['discipline'] || null,
            difficulty: extractDifficulty(metadata),
            cognitiveLevel: (metadata['cognitive_level'] || '').toUpperCase(),
            trapType: metadata['trap_type'] || null,
            hasBuzzwordPattern: buzzwordComboCorrect ? true : false,
            sourceFile: `buzzword_md`,
        },
    };
}

/**
 * Build chunks for a vignette file.
 * Chunk 1: Clinical Presentation (vignette, symptoms, labs, vitals, exam, clues)
 * Chunk 2: Teaching Points (explanation, step-by-step reasoning, educational objective)
 * Excludes: the question, answer options, correct answer, wrong options.
 */
function buildVignetteChunks(
    topic: string,
    sections: ParsedSection[],
    metadata: Record<string, string>,
    index: number,
): MarkdownChunk[] {
    const sectionMap = new Map(sections.map((s) => [s.heading, s.content]));
    const chunks: MarkdownChunk[] = [];

    // ==========================================
    // CHUNK 1: Clinical Presentation
    // ==========================================
    const clinicalParts: string[] = [];
    clinicalParts.push(`Topic: ${topic}`);

    const patientProfile = sectionMap.get('Patient Profile') || '';
    const chiefComplaint = sectionMap.get('Chief Complaint') || '';
    const vignette = sectionMap.get('Vignette') || '';
    const keySymptoms = sectionMap.get('Key Symptoms') || '';
    const labs = sectionMap.get('Labs') || '';
    const vitals = sectionMap.get('Vitals') || '';
    const physicalExam = sectionMap.get('Physical Exam') || '';
    const imaging = sectionMap.get('Imaging Findings') || '';
    const mainClue = sectionMap.get('Main Clue') || '';
    const supportingClue = sectionMap.get('Supporting Clue') || '';

    if (patientProfile) {
        clinicalParts.push(`\nPatient Profile:\n${patientProfile}`);
    }
    if (chiefComplaint && chiefComplaint !== 'NA') {
        clinicalParts.push(`\nChief Complaint:\n${chiefComplaint}`);
    }
    if (vignette) {
        // Strip answer options from the vignette section if they appear inline
        const cleanedVignette = vignette.replace(/^[A-E]\)\s.*$/gm, '').replace(/^[A-E]\.\s.*$/gm, '').trim();
        clinicalParts.push(`\nClinical Presentation:\n${cleanedVignette}`);
    }
    if (keySymptoms) {
        clinicalParts.push(`\nKey Symptoms:\n${keySymptoms}`);
    }
    if (vitals && vitals !== 'NA') {
        clinicalParts.push(`\nVitals:\n${vitals}`);
    }
    if (labs && labs !== 'NA') {
        clinicalParts.push(`\nLabs:\n${labs}`);
    }
    if (imaging && imaging !== 'NA') {
        clinicalParts.push(`\nImaging Findings:\n${imaging}`);
    }
    if (physicalExam && physicalExam !== 'NA') {
        clinicalParts.push(`\nPhysical Exam Findings:\n${physicalExam}`);
    }
    if (mainClue) {
        clinicalParts.push(`\nMain Diagnostic Clue:\n${mainClue}`);
    }
    if (supportingClue) {
        clinicalParts.push(`\nSupporting Clue:\n${supportingClue}`);
    }

    chunks.push({
        id: `vignette_${String(index).padStart(4, '0')}_${topic.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').substring(0, 40)}_clinical`,
        content: clinicalParts.join('\n'),
        metadata: {
            topic,
            sourceType: 'VIGNETTE',
            chunkType: 'CLINICAL_PRESENTATION',
            system: metadata['system'] || null,
            discipline: metadata['discipline'] || null,
            difficulty: extractDifficulty(metadata),
            cognitiveLevel: (metadata['cognitive_level'] || '').toUpperCase(),
            trapType: metadata['trap_type'] || null,
            hasVitals: vitals && vitals !== 'NA' ? true : false,
            hasLabs: labs && labs !== 'NA' ? true : false,
            hasPhysicalExam: physicalExam && physicalExam !== 'NA' ? true : false,
            sourceFile: `vignette_md`,
        },
    });

    // ==========================================
    // CHUNK 2: Teaching Points
    // ==========================================
    const explanation = sectionMap.get('Explanation') || '';
    const stepByStep = sectionMap.get('Step-by-Step Reasoning') || '';
    const educationalObjective = sectionMap.get('Educational Objective') || '';
    const relatedConcepts = sectionMap.get('Related Concepts') || '';

    // Only add this chunk if there's actual teaching content
    if (explanation || stepByStep || educationalObjective || relatedConcepts) {
        const teachingParts: string[] = [];
        teachingParts.push(`Topic: ${topic}`);

        if (explanation) {
            teachingParts.push(`\nExplanation:\n${explanation}`);
        }
        if (stepByStep) {
            teachingParts.push(`\nStep-by-Step Reasoning:\n${stepByStep}`);
        }
        if (educationalObjective) {
            teachingParts.push(`\nEducational Objective:\n${educationalObjective}`);
        }
        if (relatedConcepts) {
            teachingParts.push(`\nRelated Concepts:\n${relatedConcepts}`);
        }

        chunks.push({
            id: `vignette_${String(index).padStart(4, '0')}_${topic.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').substring(0, 40)}_teaching`,
            content: teachingParts.join('\n'),
            metadata: {
                topic,
                sourceType: 'VIGNETTE',
                chunkType: 'TEACHING_POINTS',
                system: metadata['system'] || null,
                discipline: metadata['discipline'] || null,
                difficulty: extractDifficulty(metadata),
                cognitiveLevel: (metadata['cognitive_level'] || '').toUpperCase(),
                trapType: metadata['trap_type'] || null,
                hasExplanation: explanation ? true : false,
                hasStepByStep: stepByStep ? true : false,
                hasEducationalObjective: educationalObjective ? true : false,
                sourceFile: `vignette_md`,
            },
        });
    }

    return chunks;
}

// ============================================
// FILE PROCESSING
// ============================================

function readMarkdownFiles(directory: string): { filename: string; content: string }[] {
    const files: { filename: string; content: string }[] = [];

    if (!fs.existsSync(directory)) {
        logger.warn(`Directory not found: ${directory}`);
        return files;
    }

    const entries = fs.readdirSync(directory);

    for (const entry of entries) {
        const filePath = path.join(directory, entry);
        const stat = fs.statSync(filePath);

        if (stat.isFile() && entry.endsWith('.md')) {
            const content = fs.readFileSync(filePath, 'utf-8').trim();
            if (content) {
                files.push({ filename: entry, content });
            }
        }
    }

    return files.sort((a, b) => a.filename.localeCompare(b.filename));
}

// ============================================
// MAIN
// ============================================

async function main() {
    logger.log('========================================');
    logger.log('  Markdown Ingest Pipeline');
    logger.log('========================================');
    logger.log('');

    // 1. Create a NestJS application context (just for DI)
    const app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    });

    const chromaService = app.get(ChromaService);

    // 2. Check ChromaDB connection
    try {
        const info = await chromaService.getCollectionInfo();
        logger.log(`ChromaDB collection: "${info.name}" (${info.count} existing documents)`);
    } catch (error: any) {
        logger.error(`Failed to connect to ChromaDB: ${error.message}`);
        logger.error('Make sure Chroma Cloud credentials are set in .env');
        await app.close();
        process.exit(1);
    }

    // 3. Process buzzword files
    logger.log('');
    logger.log('--- Processing Buzzword Markdown Files ---');
    const buzzwordFiles = readMarkdownFiles(BUZZWORD_DIR);
    logger.log(`Found ${buzzwordFiles.length} buzzword markdown files`);

    const buzzwordChunks: MarkdownChunk[] = [];
    let buzzwordSkipped = 0;

    for (let i = 0; i < buzzwordFiles.length; i++) {
        const { filename, content } = buzzwordFiles[i];

        try {
            const { topic, sections } = parseMarkdownSections(content);

            // Find the metadata section
            const metadataSection = sections.find((s) => s.heading === 'Metadata');
            const metadata = metadataSection ? parseMetadataTable(metadataSection.content) : {};

            const chunk = buildBuzzwordChunk(topic, sections, metadata, i + 1);
            buzzwordChunks.push(chunk);

            if ((i + 1) % 50 === 0 || i === 0) {
                logger.log(`  Processed ${i + 1}/${buzzwordFiles.length} buzzword files...`);
            }
        } catch (error: any) {
            buzzwordSkipped++;
            logger.warn(`  Skipping ${filename}: ${error.message}`);
        }
    }

    logger.log(`  Generated ${buzzwordChunks.length} buzzword chunks (${buzzwordSkipped} skipped)`);

    // 4. Process vignette files
    logger.log('');
    logger.log('--- Processing Vignette Markdown Files ---');
    const vignetteFiles = readMarkdownFiles(VIGNETTE_DIR);
    logger.log(`Found ${vignetteFiles.length} vignette markdown files`);

    const vignetteChunks: MarkdownChunk[] = [];
    let vignetteSkipped = 0;

    for (let i = 0; i < vignetteFiles.length; i++) {
        const { filename, content } = vignetteFiles[i];

        try {
            const { topic, sections } = parseMarkdownSections(content);

            // Find the metadata section
            const metadataSection = sections.find((s) => s.heading === 'Metadata');
            const metadata = metadataSection ? parseMetadataTable(metadataSection.content) : {};

            const chunks = buildVignetteChunks(topic, sections, metadata, i + 1);
            vignetteChunks.push(...chunks);

            if ((i + 1) % 50 === 0 || i === 0) {
                logger.log(`  Processed ${i + 1}/${vignetteFiles.length} vignette files...`);
            }
        } catch (error: any) {
            vignetteSkipped++;
            logger.warn(`  Skipping ${filename}: ${error.message}`);
        }
    }

    logger.log(`  Generated ${vignetteChunks.length} vignette chunks (${vignetteSkipped} skipped)`);

    // 5. Total chunks
    const allChunks = [...buzzwordChunks, ...vignetteChunks];
    logger.log('');
    logger.log('========================================');
    logger.log(`  Total chunks to ingest: ${allChunks.length}`);
    logger.log(`    - Buzzword: ${buzzwordChunks.length}`);
    logger.log(`    - Vignette: ${vignetteChunks.length}`);
    logger.log('========================================');

    if (allChunks.length === 0) {
        logger.warn('No chunks to ingest. Exiting.');
        await app.close();
        return;
    }

    // 6. Ingest into ChromaDB in batches (to avoid overwhelming the API)
    const BATCH_SIZE = 20;
    let ingested = 0;
    let failed = 0;

    logger.log('');
    logger.log('--- Ingesting into ChromaDB ---');

    for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
        const batch = allChunks.slice(i, i + BATCH_SIZE);

        try {
            await chromaService.addDocuments(
                batch.map((chunk) => ({
                    id: chunk.id,
                    content: chunk.content,
                    metadata: chunk.metadata,
                })),
            );
            ingested += batch.length;
            logger.log(`  Ingested ${ingested}/${allChunks.length} chunks...`);
        } catch (error: any) {
            failed += batch.length;
            logger.error(`  Failed to ingest batch starting at index ${i}: ${error.message}`);
        }
    }

    // 7. Summary
    logger.log('');
    logger.log('========================================');
    logger.log('  INGESTION COMPLETE');
    logger.log('========================================');
    logger.log(`  Total chunks attempted: ${allChunks.length}`);
    logger.log(`  Successfully ingested: ${ingested}`);
    logger.log(`  Failed: ${failed}`);
    logger.log('');

    // Verify
    try {
        const info = await chromaService.getCollectionInfo();
        logger.log(`  ChromaDB collection now has ${info.count} documents`);
    } catch (error: any) {
        logger.warn(`  Could not verify collection count: ${error.message}`);
    }

    logger.log('');
    logger.log('Done!');

    await app.close();
}

main().catch((error) => {
    logger.error(`Fatal error: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
});