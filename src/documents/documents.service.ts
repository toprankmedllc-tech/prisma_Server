import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChromaService } from '../chroma/chroma.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { DocumentResponseDto, DocumentDetailResponseDto } from './dto/document-response.dto';

@Injectable()
export class DocumentsService {
    constructor(
        private prisma: PrismaService,
        private chroma: ChromaService,
    ) { }

    async create(dto: UploadDocumentDto): Promise<DocumentResponseDto> {
        const document = await this.prisma.document.create({
            data: {
                title: dto.title,
                source: dto.source,
                status: 'UPLOADED',
            },
        });

        return {
            id: document.id,
            title: document.title,
            source: document.source,
            status: document.status,
            chunkCount: 0,
            createdAt: document.createdAt,
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

        return documents.map((doc) => ({
            id: doc.id,
            title: doc.title,
            source: doc.source,
            status: doc.status,
            chunkCount: doc.chunks.length,
            createdAt: doc.createdAt,
        }));
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

        return {
            id: document.id,
            title: document.title,
            source: document.source,
            status: document.status,
            chunkCount: document.chunks.length,
            createdAt: document.createdAt,
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