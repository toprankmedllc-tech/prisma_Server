import { Module } from '@nestjs/common';
import { UserAnalyticsController } from './user-analytics.controller';
import { MyAnalyticsController } from './my-analytics.controller';
import { UserAnalyticsService } from './user-analytics.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AdminGuard } from '../admin/admin.guard';

@Module({
    imports: [PrismaModule, AuthModule],
    controllers: [UserAnalyticsController, MyAnalyticsController],
    providers: [UserAnalyticsService, AdminGuard],
    exports: [UserAnalyticsService],
})
export class UserAnalyticsModule { }