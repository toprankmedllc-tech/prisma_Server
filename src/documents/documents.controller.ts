import {
    Controller,
    Get,
    Post,
    Delete,
    Param,
    Body,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';

import { UploadDocumentDto } from './dto/upload-document.dto';
import { DocumentResponseDto, DocumentDetailResponseDto } from './dto/document-response.dto';
import { DocumentIngestionService } from './documents-ingestion.service';

@Controller('documents')
export class DocumentsController {
    constructor(
        private readonly documentsService: DocumentsService,
        private readonly documentIngestionService: DocumentIngestionService,
    ) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async upload(@Body() dto: UploadDocumentDto): Promise<DocumentResponseDto> {
        // Step 1: Create document record
        const document = await this.documentsService.create(dto);

        // Step 2: Ingest content into chunks and store in Chroma
        await this.documentIngestionService.ingestDocument(
            document.id,
            dto.content,
        );

        // Step 3: Return updated document
        return this.documentsService.findOne(document.id);
    }

    @Get()
    async findAll(): Promise<DocumentResponseDto[]> {
        return this.documentsService.findAll();
    }

    @Get(':id')
    async findOne(@Param('id') id: string): Promise<DocumentDetailResponseDto> {
        return this.documentsService.findOne(id);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async delete(@Param('id') id: string): Promise<void> {
        return this.documentsService.delete(id);
    }
}