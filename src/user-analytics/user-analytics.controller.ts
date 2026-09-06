import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiCookieAuth } from '@nestjs/swagger';
import { UserAnalyticsService } from './user-analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../admin/admin.guard';
import { UserAnalyticsDto } from './dto/user-analytics.dto';

@ApiTags('User Analytics')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/analytics')
export class UserAnalyticsController {
    constructor(private readonly userAnalyticsService: UserAnalyticsService) {}

    // ============================================
    // COMPREHENSIVE USER ANALYTICS
    // ============================================
    @Get('users/:userId')
    @ApiOperation({
        summary: 'Comprehensive user analytics',
        description:
            'Returns hard-core analytics for a user: overview stats, daily activity heatmap, streaks, accuracy by topic/subject, weekly performance trend, study session history, mock exam history, and engagement signals (flags/highlights).',
    })
    @ApiParam({ name: 'userId', description: 'User ID' })
    @ApiQuery({
        name: 'days',
        required: false,
        type: Number,
        description: 'Number of days to look back for heatmap and weekly trend (default 90)',
    })
    async getUserAnalytics(
        @Param('userId') userId: string,
        @Query('days') days?: string,
    ): Promise<UserAnalyticsDto> {
        return this.userAnalyticsService.getUserAnalytics(
            userId,
            days ? parseInt(days) : 90,
        );
    }

    // ============================================
    // ACTIVITY HEATMAP ONLY
    // ============================================
    @Get('users/:userId/heatmap')
    @ApiOperation({
        summary: 'User activity heatmap',
        description:
            'Returns a dense daily activity series (questions answered, correct, time spent) for the user over the given window.',
    })
    @ApiParam({ name: 'userId', description: 'User ID' })
    @ApiQuery({
        name: 'days',
        required: false,
        type: Number,
        description: 'Number of days to look back (default 90)',
    })
    async getHeatmap(
        @Param('userId') userId: string,
        @Query('days') days?: string,
    ) {
        const analytics = await this.userAnalyticsService.getUserAnalytics(
            userId,
            days ? parseInt(days) : 90,
        );
        return analytics.heatmap;
    }

    // ============================================
    // STREAKS ONLY
    // ============================================
    @Get('users/:userId/streaks')
    @ApiOperation({
        summary: 'User streaks',
        description:
            'Returns the user current daily streak, longest streak, and last active date.',
    })
    @ApiParam({ name: 'userId', description: 'User ID' })
    async getStreaks(@Param('userId') userId: string) {
        const analytics = await this.userAnalyticsService.getUserAnalytics(userId, 90);
        return analytics.streaks;
    }
}