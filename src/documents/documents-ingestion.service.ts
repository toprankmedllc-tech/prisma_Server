// apps/backend/src/documents/document-ingestion.service.ts

import { Injectable } from "@nestjs/common";
import { ChromaService } from "../chroma/chroma.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DocumentIngestionService {
    constructor(
        private prisma: PrismaService,
        private chroma: ChromaService,
    ) { }

    async ingestDocument(documentId: string, text: string) {
        // 1. Chunk the text (simple recursive splitter)
        const chunks = this.chunkText(text, { chunkSize: 1000, overlap: 100 });

        // 2. Create DocumentChunk records in PostgreSQL
        const dbChunks = await Promise.all(
            chunks.map((content, index) =>
                this.prisma.documentChunk.create({
                    data: {
                        documentId,
                        chunkIndex: index,
                        content,
                        metadata: { source: 'ingestion' },
                    },
                })
            )
        );

        // 3. Store in Chroma (Chroma handles embedding automatically)
        await this.chroma.addDocuments(
            dbChunks.map(chunk => ({
                id: chunk.id,           // uses PostgreSQL CUID as Chroma ID
                content: chunk.content,
                metadata: {
                    documentId,
                    chunkIndex: chunk.chunkIndex,
                },
            }))
        );

        // 4. Update vectorId in PostgreSQL
        await Promise.all(
            dbChunks.map(chunk =>
                this.prisma.documentChunk.update({
                    where: { id: chunk.id },
                    data: { vectorId: chunk.id },   // same ID used in both systems
                })
            )
        );

        // 5. Update document status
        await this.prisma.document.update({
            where: { id: documentId },
            data: { status: 'INDEXED' },
        });
    }

    private chunkText(text: string, options: { chunkSize: number; overlap: number }): string[] {
        // Simple splitting – can be improved later
        const words = text.split(' ');
        const chunks: string[] = [];
        for (let i = 0; i < words.length; i += options.chunkSize - options.overlap) {
            chunks.push(words.slice(i, i + options.chunkSize).join(' '));
        }
        return chunks;
    }
}