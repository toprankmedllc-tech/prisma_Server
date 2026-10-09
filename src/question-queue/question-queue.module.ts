import { Module, forwardRef } from '@nestjs/common';
import { QuestionQueueService } from './question-queue.service';
import { QuestionQueueProcessor } from './question-queue.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { QuestionsModule } from '../questions/questions.module';

// ============================================
// QUESTION QUEUE MODULE
// ============================================
// Provides:
// - PostgreSQL-based job queue for background question generation
// - Queue service for adding/checking jobs
// - Queue worker for processing jobs (uses SKIP LOCKED)
// ============================================

@Module({
    imports: [
        PrismaModule,
        forwardRef(() => QuestionsModule), // Import QuestionsModule to get QuestionGenerationService
    ],
    providers: [
        QuestionQueueService,
        QuestionQueueProcessor,
    ],
    exports: [QuestionQueueService],
})
export class QuestionQueueModule { }
