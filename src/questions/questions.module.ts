import { Module } from '@nestjs/common';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';
import { QuestionGenerationService } from './question-generation.service';
import { LLMModule } from '../llm/llm.module';

import { PrismaModule } from '../prisma/prisma.module';
import { ChromaModule } from '../chroma/chroma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [LLMModule, ChromaModule, PrismaModule, AuthModule],
    controllers: [QuestionsController],
    providers: [QuestionsService, QuestionGenerationService],
    exports: [QuestionsService, QuestionGenerationService],
})
export class QuestionsModule { }