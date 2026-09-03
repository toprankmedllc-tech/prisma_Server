import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QuestionQueueService } from './question-queue.service';
import { QuestionQueueProcessor } from './question-queue.processor';
import { QuestionGenerationGateway } from './question-generation.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { QuestionsModule } from '../questions/questions.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

// ============================================
// QUESTION QUEUE MODULE
// ============================================
// Provides:
// - BullMQ queue for background question generation
// - Socket.IO gateway for real-time notifications
// - Queue service for adding jobs
// - Queue worker for processing jobs
// ============================================

@Module({
    imports: [
        // Register the queue (forRoot is in AppModule)
        BullModule.registerQueue({
            name: 'question-generation',
        }),
        PrismaModule,
        forwardRef(() => QuestionsModule), // Import QuestionsModule to get QuestionGenerationService
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_ACCESS_SECRET', 'access-secret'),
                signOptions: { expiresIn: '30d' },
            }),
        }),
    ],
    providers: [
        QuestionQueueService,
        QuestionQueueProcessor,
        QuestionGenerationGateway,
    ],
    exports: [QuestionQueueService, QuestionGenerationGateway, BullModule],
})
export class QuestionQueueModule { }