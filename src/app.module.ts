import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [configuration],
    }),
    // BullMQ root configuration (Redis connection)
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // Prefer a full REDIS_URL (e.g. Upstash, Redis Cloud, Railway) when set.
        // Otherwise fall back to individual REDIS_HOST/PORT/PASSWORD/DB fields.
        const redisUrl = configService.get<string>('REDIS_URL', '');

        let connection: Record<string, any>;
        if (redisUrl) {
          connection = { url: redisUrl };
        } else {
          const redisHost = configService.get<string>('REDIS_HOST', 'localhost');
          const redisPort = configService.get<number>('REDIS_PORT', 6379);
          const redisPassword = configService.get<string>('REDIS_PASSWORD', '');
          const redisDb = configService.get<number>('REDIS_DB', 0);

          connection = {
            host: redisHost,
            port: redisPort,
            db: redisDb,
          };

          if (redisPassword) {
            connection.password = redisPassword;
          }
        }

        return {
          connection,
          defaultJobOptions: {
            removeOnComplete: { age: 86400 },
            removeOnFail: { age: 86400 },
            attempts: 3,
            backoff: {
              type: 'exponential' as const,
              delay: 5000,
            },
          },
        };
      },
    }),
    AuthModule,
    PrismaModule,
    ExamsModule,
    QuestionsModule,
    ChromaModule,
    LLMModule,
    DocumentsModule,
    DashboardModule,
    AdminModule,
    QuestionQueueModule,
    AiReviewModule,
    StudyModule,
    HighlightModule,
    UserAnalyticsModule,
  ],
})
export class AppModule { }