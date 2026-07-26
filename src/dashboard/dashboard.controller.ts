import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Dashboard')
@Controller('dashboard')
// @UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('readiness/:userId')
  @ApiOperation({ summary: 'Get exam readiness dashboard for a user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  async getExamReadiness(@Param('userId') userId: string) {
    return this.dashboardService.getExamReadiness(userId);
  }
}
