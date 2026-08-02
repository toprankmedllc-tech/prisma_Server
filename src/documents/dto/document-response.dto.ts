import { DocumentStatus } from '@prisma/client';
import { ChunkStrategy } from './chunking-config.dto';

export class DocumentChunkResponseDto {
    id!: string;
    documentId!: string;
    chunkIndex!: number;
    content!: string;
    chromaId!: string | null;
    createdAt!: Date;
}

export class DocumentResponseDto {
    id!: string;
    title!: string;
    source!: string | null;
    fileType!: string | null;
    charCount!: number | null;
    status!: DocumentStatus;
    chunkCount!: number;
    chunkingConfig!: {
        strategy: ChunkStrategy;
        chunkSize: number;
        chunkOverlap: number;
    } | null;
    createdAt!: Date;
    updatedAt!: Date;
}

export class DocumentDetailResponseDto extends DocumentResponseDto {
    content!: string | null;
    chunks!: DocumentChunkResponseDto[];
}

export class DocumentIngestionResultDto {
    id!: string;
    title!: string;
    status!: DocumentStatus;
    chunkCount!: number;
    message!: string;
}
