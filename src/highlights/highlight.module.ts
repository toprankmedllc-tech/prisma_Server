import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { HighlightController } from './highlight.controller';
import { HighlightService } from './highlight.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [HighlightController],
  providers: [HighlightService],
  exports: [HighlightService],
})
export class HighlightModule {}