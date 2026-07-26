import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ExamService } from './services/exam.service';
import { ExamController } from './controllers/exam.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ExamController],
  providers: [ExamService],
  exports: [ExamService],
})
export class ExamsModule {}
