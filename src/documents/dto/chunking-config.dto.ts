import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString,
    IsOptional,
    IsObject,
    IsNumber,
    Min,
    Max,
    IsEnum,
    IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Chunking strategies supported by the ingestion pipeline.
 * - WORD: Split by word count (chunkSize = words per chunk, overlap = overlapping words)
 * - PARAGRAPH: Split by paragraphs, then merge until near chunkSize chars
 * - MARKDOWN: Heading-aware split (keeps ## sections intact), then recursive split
 * - FIXED_SIZE: Split by character count (chunkSize = chars per chunk, overlap = overlapping chars)
 * - SEMANTIC: Split on paragraph boundaries with similarity-aware grouping
 */
export enum ChunkStrategy {
    WORD = 'WORD',
    PARAGRAPH = 'PARAGRAPH',
    MARKDOWN = 'MARKDOWN',
    FIXED_SIZE = 'FIXED_SIZE',
    SEMANTIC = 'SEMANTIC',
}

export class ChunkingConfigDto {
    @ApiPropertyOptional({
        enum: ChunkStrategy,
        default: ChunkStrategy.MARKDOWN,
        description: 'Chunking strategy used to split the document',
    })
    @IsOptional()
    @IsEnum(ChunkStrategy)
    strategy?: ChunkStrategy;

    @ApiPropertyOptional({
        type: Number,
        default: 1000,
        minimum: 100,
        maximum: 8000,
        description:
            'Target chunk size. Unit depends on strategy (words for WORD, chars for FIXED_SIZE/PARAGRAPH/MARKDOWN).',
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(100)
    @Max(8000)
    chunkSize?: number;

    @ApiPropertyOptional({
        type: Number,
        default: 100,
        minimum: 0,
        maximum: 1000,
        description:
            'Number of overlapping tokens/chars between consecutive chunks.',
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @Max(1000)
    chunkOverlap?: number;

    @ApiPropertyOptional({
        type: Boolean,
        default: false,
        description:
            'Strip markdown syntax (headings, bold, links) before chunking, keeping plain text.',
    })
    @IsOptional()
    @IsBoolean()
    stripMarkdown?: boolean;

    @ApiPropertyOptional({
        type: Boolean,
        default: true,
        description:
            'Keep the document title/topic as a prefix in every chunk to preserve context.',
    })
    @IsOptional()
    @IsBoolean()
    includeTitlePrefix?: boolean;
}

export class UploadDocumentDto {
    @ApiProperty({ description: 'Document title (used as topic context)' })
    @IsString()
    title!: string;

    @ApiProperty({
        description:
            'Document content. Can be markdown, plain text, or HTML.',
    })
    @IsString()
    content!: string;

    @ApiPropertyOptional({
        description: 'Source of the document (e.g. filename, URL, "manual paste")',
    })
    @IsOptional()
    @IsString()
    source?: string;

    @ApiPropertyOptional({
        description: 'File type hint: markdown, text, html, pdf, docx',
    })
    @IsOptional()
    @IsString()
    fileType?: string;

    @ApiPropertyOptional({
        type: ChunkingConfigDto,
        description: 'Chunking rules used by the ingestion pipeline',
    })
    @IsOptional()
    @IsObject()
    chunkingConfig?: ChunkingConfigDto;

    @ApiPropertyOptional({
        type: Object,
        description: 'Arbitrary metadata attached to the document',
    })
    @IsOptional()
    @IsObject()
    metadata?: Record<string, any>;
}

export class ReingestDocumentDto {
    @ApiPropertyOptional({
        type: ChunkingConfigDto,
        description:
            'Override chunking rules for re-ingestion. Falls back to stored config if omitted.',
    })
    @IsOptional()
    @IsObject()
    chunkingConfig?: ChunkingConfigDto;
}
