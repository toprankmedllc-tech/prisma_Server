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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env', // 🔥 ADD THIS
      load: [configuration],
    }),
    AuthModule,
    PrismaModule,
    ExamsModule,
    QuestionsModule,
    ChromaModule,
    LLMModule,
    DocumentsModule,
    DashboardModule
  ],
})
export class AppModule { }