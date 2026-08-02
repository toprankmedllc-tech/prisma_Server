import {
    Controller,
    Get,
    Post,
    Delete,
    Param,
    Body,
    HttpCode,
    HttpStatus,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
    Query,
    Patch,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';

import { UploadDocumentDto, ReingestDocumentDto } from './dto/upload-document.dto';
import {
    DocumentResponseDto,
    DocumentDetailResponseDto,
    DocumentIngestionResultDto,
} from './dto/document-response.dto';
import { DocumentIngestionService } from './documents-ingestion.service';
import { ApiCookieAuth, ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// Multer types are available via @nestjs/platform-express

@ApiTags('Documents')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
    constructor(
        private readonly documentsService: DocumentsService,
        private readonly documentIngestionService: DocumentIngestionService,
    ) { }

    // ============================================
    // UPLOAD TEXT CONTENT (markdown, plain text, HTML)
    // ============================================
    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Upload text content (markdown/plain text/HTML)',
        description:
            'Creates a document record and ingests it into the vector database. ' +
            'Supports configurable chunking rules. Use this for pasting markdown or text content.',
    })
    async upload(@Body() dto: UploadDocumentDto): Promise<DocumentIngestionResultDto> {
        // Step 1: Create document record
        const document = await this.documentsService.create(dto);

        // Step 2: Ingest content into chunks and store in Chroma
        const config = dto.chunkingConfig || {};
        const result = await this.documentIngestionService.ingestDocument(
            document.id,
            dto.content,
            config,
            dto.title,
        );

        // Step 3: Return result
        const updated = await this.documentsService.findOne(document.id);
        return {
            id: updated.id,
            title: updated.title,
            status: updated.status,
            chunkCount: updated.chunks.length,
            message: `Document "${dto.title}" ingested successfully (${updated.chunks.length} chunks)`,
        };
    }

    // ============================================
    // UPLOAD FILE (markdown, text, HTML files)
    // ============================================
    @Post('upload')
    @HttpCode(HttpStatus.CREATED)
    @UseInterceptors(FileInterceptor('file'))
    @ApiOperation({
        summary: 'Upload a file (markdown, text, HTML)',
        description:
            'Upload a file (.md, .txt, .html) and ingest it into the vector database. ' +
            'The file content is read as text and processed through the chunking pipeline.',
    })
    @ApiConsumes('multipart/form-data')
    async uploadFile(
        @UploadedFile() file: any,
        @Body() body: any,
    ): Promise<DocumentIngestionResultDto> {
        if (!file) {
            throw new BadRequestException('No file uploaded');
        }

        // Determine file type from mimetype or extension
        const fileType = this.detectFileType(file.originalname, file.mimetype);

        // Only allow text-based files
        if (!fileType) {
            throw new BadRequestException(
                'Unsupported file type. Accepted: .md, .markdown, .txt, .html',
            );
        }

        // Read file content as text
        const content = file.buffer.toString('utf-8');

        if (!content.trim()) {
            throw new BadRequestException('File is empty');
        }

        // Extract title from body or filename
        const title = body.title || this.filenameToTitle(file.originalname);
        const source = body.source || file.originalname;

        // Parse chunking config from body
        const chunkingConfig = body.chunkingConfig
            ? (typeof body.chunkingConfig === 'string'
                ? JSON.parse(body.chunkingConfig)
                : body.chunkingConfig)
            : {};

        const dto: UploadDocumentDto = {
            title,
            content,
            source,
            fileType,
            chunkingConfig,
            metadata: body.metadata
                ? (typeof body.metadata === 'string'
                    ? JSON.parse(body.metadata)
                    : body.metadata)
                : undefined,
        };

        // Create document record
        const document = await this.documentsService.create(dto);

        // Ingest into vector database
        const result = await this.documentIngestionService.ingestDocument(
            document.id,
            content,
            chunkingConfig,
            title,
        );

        const updated = await this.documentsService.findOne(document.id);
        return {
            id: updated.id,
            title: updated.title,
            status: updated.status,
            chunkCount: updated.chunks.length,
            message: `File "${file.originalname}" ingested successfully (${updated.chunks.length} chunks)`,
        };
    }

    // ============================================
    // LIST ALL DOCUMENTS
    // ============================================
    @Get()
    @ApiOperation({
        summary: 'List all documents',
        description:
            'Returns all documents ordered by creation date (newest first).',
    })
    async findAll(): Promise<DocumentResponseDto[]> {
        return this.documentsService.findAll();
    }

    // ============================================
    // GET DOCUMENT DETAIL
    // ============================================
    @Get(':id')
    @ApiOperation({
        summary: 'Get document details with chunks',
        description:
            'Returns a single document with its full content and all chunks.',
    })
    async findOne(@Param('id') id: string): Promise<DocumentDetailResponseDto> {
        return this.documentsService.findOne(id);
    }

    // ============================================
    // RE-INGEST DOCUMENT
    // ============================================
    @Patch(':id/reingest')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Re-ingest a document',
        description:
            'Deletes existing chunks and re-ingests the document with (optionally) new chunking rules.',
    })
    async reingest(
        @Param('id') id: string,
        @Body() dto: ReingestDocumentDto,
    ): Promise<DocumentIngestionResultDto> {
        const result = await this.documentIngestionService.reingestDocument(
            id,
            dto.chunkingConfig,
        );

        const updated = await this.documentsService.findOne(id);
        return {
            id: updated.id,
            title: updated.title,
            status: updated.status,
            chunkCount: updated.chunks.length,
            message: `Document re-ingested successfully (${updated.chunks.length} chunks)`,
        };
    }

    // ============================================
    // DELETE DOCUMENT
    // ============================================
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: 'Delete a document',
        description:
            'Deletes a document and its chunks from both PostgreSQL and ChromaDB.',
    })
    async delete(@Param('id') id: string): Promise<void> {
        return this.documentsService.delete(id);
    }

    // ============================================
    // HELPERS
    // ============================================

    /**
     * Detect file type from filename extension and mime type.
     * Returns null for unsupported types.
     */
    private detectFileType(
        filename: string,
        mimetype: string,
    ): string | null {
        const ext = filename.split('.').pop()?.toLowerCase();
        const textMimes = [
            'text/plain',
            'text/markdown',
            'text/html',
            'text/x-markdown',
        ];

        if (
            ext === 'md' ||
            ext === 'markdown' ||
            mimetype === 'text/markdown' ||
            mimetype === 'text/x-markdown'
        ) {
            return 'markdown';
        }
        if (ext === 'txt' || mimetype === 'text/plain') {
            return 'text';
        }
        if (ext === 'html' || ext === 'htm' || mimetype === 'text/html') {
            return 'html';
        }

        return null;
    }

    /**
     * Convert a filename to a readable title.
     * E.g., "my-awesome-doc.md" -> "My Awesome Doc"
     */
    private filenameToTitle(filename: string): string {
        return filename
            .replace(/\.[^/.]+$/, '')           // Remove extension
            .replace(/[-_]+/g, ' ')              // Replace dashes/underscores with spaces
            .replace(/\b\w/g, (c) => c.toUpperCase()) // Title case
            .trim();
    }
}