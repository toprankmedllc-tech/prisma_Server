import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiCookieAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { UserAnalyticsService } from './user-analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserAnalyticsDto } from './dto/user-analytics.dto';

interface RequestWithUser extends Request {
    user: { id: string };
}

@ApiTags('My Analytics')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('analytics/me')
export class MyAnalyticsController {
    constructor(private readonly userAnalyticsService: UserAnalyticsService) {}

    // ============================================
    // COMPREHENSIVE ANALYTICS FOR THE CURRENT USER
    // ============================================
    @Get()
    @ApiOperation({
        summary: 'My comprehensive analytics',
        description:
            'Returns hard-core analytics for the authenticated student: overview stats, daily activity heatmap, streaks, accuracy by topic/subject, weekly performance trend, study session history, mock exam history, and engagement signals.',
    })
    @ApiQuery({
        name: 'days',
        required: false,
        type: Number,
        description: 'Number of days to look back for heatmap and weekly trend (default 90)',
    })
    async getMyAnalytics(
        @Req() req: RequestWithUser,
        @Query('days') days?: string,
    ): Promise<UserAnalyticsDto> {
        return this.userAnalyticsService.getUserAnalytics(
            req.user.id,
            days ? parseInt(days) : 90,
        );
    }

    // ============================================
    // ACTIVITY HEATMAP ONLY
    // ============================================
    @Get('heatmap')
    @ApiOperation({
        summary: 'My activity heatmap',
        description:
            'Returns a dense daily activity series (questions answered, correct, time spent) for the authenticated user.',
    })
    @ApiQuery({
        name: 'days',
        required: false,
        type: Number,
        description: 'Number of days to look back (default 90)',
    })
    async getMyHeatmap(
        @Req() req: RequestWithUser,
        @Query('days') days?: string,
    ) {
        const analytics = await this.userAnalyticsService.getUserAnalytics(
            req.user.id,
            days ? parseInt(days) : 90,
        );
        return analytics.heatmap;
    }

    // ============================================
    // STREAKS ONLY
    // ============================================
    @Get('streaks')
    @ApiOperation({
        summary: 'My streaks',
        description:
            'Returns the authenticated user current daily streak, longest streak, and last active date.',
    })
    async getMyStreaks(@Req() req: RequestWithUser) {
        const analytics = await this.userAnalyticsService.getUserAnalytics(req.user.id, 90);
        return analytics.streaks;
    }
}