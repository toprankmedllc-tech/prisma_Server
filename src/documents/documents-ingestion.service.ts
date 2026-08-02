// apps/backend/src/documents/document-ingestion.service.ts

import { Injectable, Logger } from "@nestjs/common";
import { ChromaService } from "../chroma/chroma.service";
import { PrismaService } from "../prisma/prisma.service";
import { ChunkStrategy, ChunkingConfigDto } from "./dto/chunking-config.dto";

interface ChunkResult {
    content: string;
    index: number;
}

@Injectable()
export class DocumentIngestionService {
    private readonly logger = new Logger(DocumentIngestionService.name);

    // Default chunking configuration
    private readonly DEFAULTS = {
        strategy: ChunkStrategy.MARKDOWN,
        chunkSize: 1000,
        chunkOverlap: 100,
        stripMarkdown: false,
        includeTitlePrefix: true,
    };

    constructor(
        private prisma: PrismaService,
        private chroma: ChromaService,
    ) { }

    /**
     * Full ingestion pipeline:
     *   UPLOADED -> CHUNKED -> EMBEDDING -> INDEXED
     */
    async ingestDocument(
        documentId: string,
        content: string,
        config?: ChunkingConfigDto,
        title?: string,
    ): Promise<{ chunkCount: number }> {
        const mergedConfig = { ...this.DEFAULTS, ...config };
        const titlePrefix = title || 'Untitled';

        // 1. Update status to PROCESSING
        await this.prisma.document.update({
            where: { id: documentId },
            data: { status: 'PROCESSING' },
        });

        // 2. Chunk the text using the selected strategy
        this.logger.log(
            `Chunking document "${titlePrefix}" (strategy=${mergedConfig.strategy}, ` +
            `chunkSize=${mergedConfig.chunkSize}, overlap=${mergedConfig.chunkOverlap})`,
        );

        const chunks = this.chunkText(
            content,
            mergedConfig,
            titlePrefix,
        );

        this.logger.log(`Generated ${chunks.length} chunks`);

        // 3. Update status to CHUNKED
        await this.prisma.document.update({
            where: { id: documentId },
            data: { status: 'CHUNKED' },
        });

        // 4. Create DocumentChunk records in PostgreSQL
        const dbChunks = await Promise.all(
            chunks.map((chunk) =>
                this.prisma.documentChunk.create({
                    data: {
                        documentId,
                        chunkIndex: chunk.index,
                        content: chunk.content,
                        metadata: {
                            strategy: mergedConfig.strategy,
                            chunkSize: mergedConfig.chunkSize,
                            chunkOverlap: mergedConfig.chunkOverlap,
                        },
                    },
                })
            )
        );

        // 5. Update status to EMBEDDING
        await this.prisma.document.update({
            where: { id: documentId },
            data: { status: 'EMBEDDING' },
        });

        // 6. Store in Chroma (Chroma handles embedding automatically via EmbeddedService)
        try {
            await this.chroma.addDocuments(
                dbChunks.map(chunk => ({
                    id: chunk.id,           // uses PostgreSQL CUID as Chroma ID
                    content: chunk.content,
                    metadata: {
                        documentId,
                        chunkIndex: chunk.chunkIndex,
                        title: titlePrefix,
                        strategy: mergedConfig.strategy,
                    },
                }))
            );

            // 7. Update vectorId in PostgreSQL
            await Promise.all(
                dbChunks.map(chunk =>
                    this.prisma.documentChunk.update({
                        where: { id: chunk.id },
                        data: { vectorId: chunk.id },   // same ID used in both systems
                    })
                )
            );

            // 8. Update document status to INDEXED
            await this.prisma.document.update({
                where: { id: documentId },
                data: { status: 'INDEXED' },
            });

            this.logger.log(
                `Document "${titlePrefix}" ingested successfully: ${chunks.length} chunks indexed`,
            );
        } catch (error: any) {
            this.logger.error(
                `Failed to embed document "${titlePrefix}": ${error.message}`,
            );
            await this.prisma.document.update({
                where: { id: documentId },
                data: { status: 'FAILED' },
            });
            throw error;
        }

        return { chunkCount: chunks.length };
    }

    /**
     * Re-ingest an existing document (delete old chunks, re-chunk, re-embed).
     */
    async reingestDocument(
        documentId: string,
        config?: ChunkingConfigDto,
    ): Promise<{ chunkCount: number }> {
        // 1. Fetch the document with its current content
        const document = await this.prisma.document.findUnique({
            where: { id: documentId },
            include: { chunks: true },
        });

        if (!document) {
            throw new Error(`Document with ID "${documentId}" not found`);
        }

        if (!document.content) {
            throw new Error(
                `Document "${document.title}" has no stored content. Cannot re-ingest without content.`,
            );
        }

        // 2. Delete existing chunks from Chroma
        const chromaIds = document.chunks
            .filter((chunk) => chunk.vectorId)
            .map((chunk) => chunk.vectorId!);

        if (chromaIds.length > 0) {
            await this.chroma.deleteDocuments(chromaIds);
        }

        // 3. Delete existing chunk records from PostgreSQL
        await this.prisma.documentChunk.deleteMany({
            where: { documentId },
        });

        // 4. Update status to UPLOADED (reset)
        await this.prisma.document.update({
            where: { id: documentId },
            data: { status: 'UPLOADED' },
        });

        // 5. Ingest with (potentially new) config
        // Merge with stored config if no override provided
        const storedConfig = (document.metadata as any)?.chunkingConfig || {};
        const mergedConfig = config
            ? { ...this.DEFAULTS, ...storedConfig, ...config }
            : { ...this.DEFAULTS, ...storedConfig };

        return this.ingestDocument(
            documentId,
            document.content,
            mergedConfig,
            document.title,
        );
    }

    // =============================================
    // CHUNKING STRATEGIES
    // =============================================

    private chunkText(
        text: string,
        config: ChunkingConfigDto & { stripMarkdown?: boolean; includeTitlePrefix?: boolean },
        titlePrefix: string,
    ): ChunkResult[] {
        const { strategy, chunkSize, chunkOverlap, stripMarkdown, includeTitlePrefix } = {
            ...this.DEFAULTS,
            ...config,
        };

        // Pre-process: strip markdown if requested
        let processedText = text;
        if (stripMarkdown) {
            processedText = this.stripMarkdownSyntax(text);
        }

        // Choose strategy
        let chunks: string[];
        switch (strategy) {
            case ChunkStrategy.MARKDOWN:
                chunks = this.chunkByMarkdownHeadings(processedText, chunkSize, chunkOverlap);
                break;
            case ChunkStrategy.PARAGRAPH:
                chunks = this.chunkByParagraphs(processedText, chunkSize, chunkOverlap);
                break;
            case ChunkStrategy.FIXED_SIZE:
                chunks = this.chunkByFixedSize(processedText, chunkSize, chunkOverlap);
                break;
            case ChunkStrategy.SEMANTIC:
                chunks = this.chunkByParagraphs(processedText, chunkSize, chunkOverlap);
                break;
            case ChunkStrategy.WORD:
            default:
                chunks = this.chunkByWords(processedText, chunkSize, chunkOverlap);
                break;
        }

        // Post-process: add title prefix to each chunk
        if (includeTitlePrefix) {
            chunks = chunks.map((chunk) => `# ${titlePrefix}\n\n${chunk}`);
        }

        // Filter out empty chunks
        chunks = chunks.filter((ch) => ch.trim().length > 0);

        return chunks.map((content, index) => ({
            content,
            index,
        }));
    }

    /**
     * Strategy 1: WORD - Split by word count
     */
    private chunkByWords(text: string, chunkSize: number, overlap: number): string[] {
        const words = text.split(/\s+/);
        const chunks: string[] = [];
        const step = Math.max(1, chunkSize - overlap);

        for (let i = 0; i < words.length; i += step) {
            const chunk = words.slice(i, i + chunkSize).join(' ');
            if (chunk.trim()) {
                chunks.push(chunk);
            }
        }

        return chunks;
    }

    /**
     * Strategy 2: PARAGRAPH - Split by double newlines, merge until near chunkSize
     */
    private chunkByParagraphs(text: string, chunkSize: number, overlap: number): string[] {
        const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
        const chunks: string[] = [];
        let currentChunk = '';

        for (const paragraph of paragraphs) {
            // If adding this paragraph would exceed the chunk size, start a new chunk
            if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 0) {
                // Apply overlap: keep the last `overlap` characters from the previous chunk
                if (overlap > 0 && currentChunk.length > overlap) {
                    const overlapText = currentChunk.slice(-overlap);
                    // Find the last paragraph break in the overlap region
                    const lastBreak = overlapText.lastIndexOf('\n');
                    const overlapPara = lastBreak >= 0
                        ? overlapText.slice(lastBreak).trim()
                        : overlapText.trim();
                    if (overlapPara) {
                        currentChunk = overlapPara + '\n\n' + paragraph;
                        continue;
                    }
                }
                chunks.push(currentChunk.trim());
                currentChunk = paragraph;
            } else {
                currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
            }
        }

        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }

        return chunks;
    }

    /**
     * Strategy 3: MARKDOWN - Heading-aware split.
     * Keeps ## sections intact, then splits large sections recursively.
     */
    private chunkByMarkdownHeadings(text: string, chunkSize: number, overlap: number): string[] {
        // First, try to split by ## headings
        const headingRegex = /^##\s+(.+)$/gm;
        const sections: { heading: string; content: string }[] = [];

        let lastIndex = 0;
        let lastHeading = 'preamble';
        let match: RegExpExecArray | null;

        // Collect all ## heading positions
        const headingMatches: { heading: string; index: number }[] = [];
        while ((match = headingRegex.exec(text)) !== null) {
            headingMatches.push({
                heading: match[1].trim(),
                index: match.index,
            });
        }

        // Extract content between headings
        for (let i = 0; i < headingMatches.length; i++) {
            const start = headingMatches[i].index;
            const end = i + 1 < headingMatches.length
                ? headingMatches[i + 1].index
                : text.length;

            const headingText = headingMatches[i].heading;
            const contentAfterHeading = text
                .substring(start + headingText.length + 4, end)
                .trim();

            sections.push({
                heading: headingText,
                content: contentAfterHeading,
            });
        }

        // If no headings found, treat the whole text as a single section
        if (sections.length === 0) {
            return this.chunkByParagraphs(text, chunkSize, overlap);
        }

        // Also capture content before the first heading
        if (headingMatches.length > 0 && headingMatches[0].index > 0) {
            const preamble = text.substring(0, headingMatches[0].index).trim();
            if (preamble) {
                sections.unshift({
                    heading: 'Introduction',
                    content: preamble,
                });
            }
        }

        // Build chunks: each section becomes at least one chunk
        // If a section is very large, split it further
        const chunks: string[] = [];

        for (const section of sections) {
            const sectionText = `## ${section.heading}\n\n${section.content}`;

            if (sectionText.length <= chunkSize) {
                chunks.push(sectionText);
            } else {
                // Large section: split by paragraphs first, then by word count if needed
                const subChunks = this.chunkByParagraphs(section.content, chunkSize, overlap);
                for (const sub of subChunks) {
                    chunks.push(`## ${section.heading}\n\n${sub}`);
                }
            }
        }

        return chunks;
    }

    /**
     * Strategy 4: FIXED_SIZE - Split by character count
     */
    private chunkByFixedSize(text: string, chunkSize: number, overlap: number): string[] {
        const chunks: string[] = [];
        const step = Math.max(1, chunkSize - overlap);

        for (let i = 0; i < text.length; i += step) {
            const chunk = text.slice(i, i + chunkSize);
            if (chunk.trim()) {
                chunks.push(chunk);
            }
        }

        return chunks;
    }

    /**
     * Strip markdown syntax to get plain text.
     */
    private stripMarkdownSyntax(text: string): string {
        return text
            // Remove heading markers (#)
            .replace(/^#{1,6}\s+/gm, '')
            // Remove bold/italic markers
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/\*(.+?)\*/g, '$1')
            .replace(/__(.+?)__/g, '$1')
            .replace(/_(.+?)_/g, '$1')
            // Remove inline code
            .replace(/`(.+?)`/g, '$1')
            // Remove links, keep text
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            // Remove images
            .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
            // Remove horizontal rules
            .replace(/^---+\s*$/gm, '')
            // Remove blockquotes
            .replace(/^>\s+/gm, '')
            // Remove list markers
            .replace(/^[\s]*[-*+]\s+/gm, '')
            .replace(/^[\s]*\d+\.\s+/gm, '')
            // Remove code blocks
            .replace(/```[\s\S]*?```/g, '')
            // Remove strikethrough
            .replace(/~~(.+?)~~/g, '$1')
            // Collapse multiple newlines
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }
}
