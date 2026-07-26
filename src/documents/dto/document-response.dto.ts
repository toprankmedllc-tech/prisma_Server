import { DocumentStatus } from '@prisma/client';

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
    status!: DocumentStatus;
    chunkCount!: number;
    createdAt!: Date;
}

export class DocumentDetailResponseDto extends DocumentResponseDto {
    chunks!: DocumentChunkResponseDto[];
}