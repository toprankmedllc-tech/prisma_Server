import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChromaService } from '../chroma/chroma.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { DocumentResponseDto, DocumentDetailResponseDto } from './dto/document-response.dto';
import { ChunkStrategy } from './dto/chunking-config.dto';

@Injectable()
export class DocumentsService {
    constructor(
        private prisma: PrismaService,
        private chroma: ChromaService,
    ) { }

    async create(dto: UploadDocumentDto): Promise<DocumentResponseDto> {
        const chunkingConfig = dto.chunkingConfig || {};
        const charCount = dto.content ? dto.content.length : 0;

        const document = await this.prisma.document.create({
            data: {
                title: dto.title,
                source: dto.source,
                fileType: dto.fileType || 'markdown',
                charCount,
                status: 'UPLOADED',
                content: dto.content,
                metadata: {
                    chunkingConfig: {
                        strategy: chunkingConfig.strategy || ChunkStrategy.MARKDOWN,
                        chunkSize: chunkingConfig.chunkSize || 1000,
                        chunkOverlap: chunkingConfig.chunkOverlap || 100,
                        stripMarkdown: chunkingConfig.stripMarkdown || false,
                        includeTitlePrefix: chunkingConfig.includeTitlePrefix !== false,
                    },
                    ...(dto.metadata || {}),
                },
            },
        });

        return {
            id: document.id,
            title: document.title,
            source: document.source,
            fileType: document.fileType,
            charCount: document.charCount,
            status: document.status,
            chunkCount: 0,
            chunkingConfig: {
                strategy: (chunkingConfig.strategy as ChunkStrategy) || ChunkStrategy.MARKDOWN,
                chunkSize: chunkingConfig.chunkSize || 1000,
                chunkOverlap: chunkingConfig.chunkOverlap || 100,
            },
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
        };
    }

    async findAll(): Promise<DocumentResponseDto[]> {
        const documents = await this.prisma.document.findMany({
            include: {
                chunks: {
                    select: { id: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return documents.map((doc) => {
            const storedConfig = (doc.metadata as any)?.chunkingConfig || {};
            return {
                id: doc.id,
                title: doc.title,
                source: doc.source,
                fileType: doc.fileType,
                charCount: doc.charCount,
                status: doc.status,
                chunkCount: doc.chunks.length,
                chunkingConfig: storedConfig.strategy
                    ? {
                          strategy: storedConfig.strategy as ChunkStrategy,
                          chunkSize: storedConfig.chunkSize || 1000,
                          chunkOverlap: storedConfig.chunkOverlap || 100,
                      }
                    : null,
                createdAt: doc.createdAt,
                updatedAt: doc.updatedAt,
            };
        });
    }

    async findOne(id: string): Promise<DocumentDetailResponseDto> {
        const document = await this.prisma.document.findUnique({
            where: { id },
            include: {
                chunks: {
                    orderBy: { chunkIndex: 'asc' },
                },
            },
        });

        if (!document) {
            throw new NotFoundException(`Document with ID "${id}" not found`);
        }

        const storedConfig = (document.metadata as any)?.chunkingConfig || {};

        return {
            id: document.id,
            title: document.title,
            source: document.source,
            fileType: document.fileType,
            charCount: document.charCount,
            status: document.status,
            chunkCount: document.chunks.length,
            content: document.content,
            chunkingConfig: storedConfig.strategy
                ? {
                      strategy: storedConfig.strategy as ChunkStrategy,
                      chunkSize: storedConfig.chunkSize || 1000,
                      chunkOverlap: storedConfig.chunkOverlap || 100,
                  }
                : null,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
            chunks: document.chunks.map((chunk) => ({
                id: chunk.id,
                documentId: chunk.documentId,
                chunkIndex: chunk.chunkIndex,
                content: chunk.content,
                chromaId: chunk.vectorId,
                createdAt: chunk.createdAt,
            })),
        };
    }

    async delete(id: string): Promise<void> {
        // 1. Fetch document with chunks to get Chroma vector IDs
        const document = await this.prisma.document.findUnique({
            where: { id },
            include: { chunks: true },
        });

        if (!document) {
            throw new NotFoundException(`Document with ID "${id}" not found`);
        }

        // 2. Delete embeddings from Chroma first
        const chromaIds = document.chunks
            .filter((chunk) => chunk.vectorId)
            .map((chunk) => chunk.vectorId!);

        if (chromaIds.length > 0) {
            await this.chroma.deleteDocuments(chromaIds);
        }

        // 3. Then delete from Postgres (cascades to DocumentChunks)
        await this.prisma.document.delete({
            where: { id },
        });
    }
}