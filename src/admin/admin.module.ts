import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { QuestionsModule } from '../questions/questions.module';
import { DocumentsModule } from '../documents/documents.module';

@Module({
    imports: [PrismaModule, AuthModule, QuestionsModule, DocumentsModule],
    controllers: [AdminController],
    providers: [AdminService, AdminGuard],
    exports: [AdminService],
})
export class AdminModule {}