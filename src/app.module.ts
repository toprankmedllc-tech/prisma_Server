import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { ExamsModule } from './exams/exams.module';
import { QuestionsModule } from './questions/questions.module';
import { ChromaModule } from './chroma/chroma.module';
import { LLMModule } from './llm/llm.module';
import { DocumentsModule } from './documents/documents.module';
import configuration from './config/configuration';
import { DashboardModule } from './dashboard/dashboard.module';
import { AdminModule } from './admin/admin.module';
import { QuestionQueueModule } from './question-queue/question-queue.module';
import { AiReviewModule } from './ai-review/ai-review.module';
import { StudyModule } from './study/study.module';
import { HighlightModule } from './highlights/highlight.module';
import { UserAnalyticsModule } from './user-analytics/user-analytics.module';
import { ArenaModule } from './arena/arena.module';
import { SocialModule } from './social/social.module';
import { ReviewModule } from './review/review.module';
import { AdaptiveModule } from './adaptive/adaptive.module';
import { BillingModule } from './billing/billing.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [configuration],
    }),
    AuthModule,
    DashboardModule,
    ExamsModule,
    StudyModule,
    QuestionsModule,
    AiReviewModule,
    ReviewModule,
    AdminModule,
    // UserAnalyticsModule,
    HighlightModule,
    AdaptiveModule,

    
    ArenaModule,
    SocialModule,
    ChromaModule,
    PrismaModule,
    LLMModule,
    DocumentsModule,
    QuestionQueueModule,
    BillingModule,




  ],
})
export class AppModule { }