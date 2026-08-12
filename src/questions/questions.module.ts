import { Module, forwardRef } from '@nestjs/common';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';
import { QuestionGenerationService } from './question-generation.service';
import { LLMModule } from '../llm/llm.module';

import { PrismaModule } from '../prisma/prisma.module';
import { ChromaModule } from '../chroma/chroma.module';
import { AuthModule } from '../auth/auth.module';
import { QuestionQueueModule } from '../question-queue/question-queue.module';
import { AiReviewModule } from '../ai-review/ai-review.module';

@Module({
    imports: [LLMModule, ChromaModule, PrismaModule, AuthModule, forwardRef(() => QuestionQueueModule), forwardRef(() => AiReviewModule)],
    controllers: [QuestionsController],
    providers: [QuestionsService, QuestionGenerationService],
    exports: [QuestionsService, QuestionGenerationService],
})
export class QuestionsModule { }