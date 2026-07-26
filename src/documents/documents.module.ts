import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

import { PrismaModule } from '../prisma/prisma.module';
import { ChromaModule } from '../chroma/chroma.module';
import { AuthModule } from '../auth/auth.module';
import { DocumentIngestionService } from './documents-ingestion.service';

@Module({
    imports: [PrismaModule, ChromaModule, AuthModule],
    controllers: [DocumentsController],
    providers: [DocumentsService, DocumentIngestionService],
    exports: [DocumentsService, DocumentIngestionService],
})
export class DocumentsModule { }