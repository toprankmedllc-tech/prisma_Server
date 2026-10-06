import { Module } from '@nestjs/common';
import { AdaptiveSessionService } from './adaptive-session.service';
import { AdaptiveSessionController } from './adaptive-session.controller';

@Module({
  providers: [AdaptiveSessionService],
  controllers: [AdaptiveSessionController],
  exports: [AdaptiveSessionService],
})
export class AdaptiveModule {}