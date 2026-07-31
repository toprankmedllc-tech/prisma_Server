import {
    Controller,
    Get,
    Post,
    Patch,
    Param,
    Query,
    Body,
    HttpCode,
    HttpStatus,
    UseGuards,
    Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiQuery, ApiCookieAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
    DashboardSummaryDto,
    UserReviewStatsListDto,
    ReviewActivityResponseDto,
    QuestionBreakdownDto,
    SubjectOptionDto,
    TopicOptionDto,
    UpdateUserRoleDto,
    UpdateUserRoleResponseDto,
} from './dto/admin.dto';
import { QuestionsService } from '../questions/questions.service';
import { QuestionGenerationService } from '../questions/question-generation.service';
import { GenerateQuestionsDto } from '../questions/dto/request.dto';
import { GenerateQuestionsResponseDto } from '../questions/dto/response.dto';

interface RequestWithUser extends Request {
    user: {
        id: string;
        email: string;
    };
}

@ApiTags('Admin')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
    constructor(
        private readonly adminService: AdminService,
        private readonly questionsService: QuestionsService,
        private readonly questionGenerationService: QuestionGenerationService,
    ) {}

    // ============================================
    // DASHBOARD SUMMARY
    // ============================================
    @Get('dashboard/summary')
    @ApiOperation({
        summary: 'Admin dashboard summary',
        description:
            'Returns an overview of users (total, admins, reviewers, active) and questions (total, published, unpublished, reviewed, approved, rejected, skipped).',
    })
    async getDashboardSummary(): Promise<DashboardSummaryDto> {
        return this.adminService.getDashboardSummary();
    }

    // ============================================
    // USER OVERVIEW
    // ============================================
    @Get('users/overview')
    @ApiOperation({
        summary: 'User overview stats',
        description:
            'Returns user statistics: total users, admins, reviewers, and active users.',
    })
    async getUserOverview() {
        return this.adminService.getUserOverview();
    }

    // ============================================
    // USER REVIEW STATS (detailed per-user)
    // ============================================
    @Get('users/review-stats')
    @ApiOperation({
        summary: 'User review statistics',
        description:
            'Returns detailed per-user review statistics: how many questions each user has reviewed, skipped, approved, rejected, and currently assigned.',
    })
    async getUserReviewStats(): Promise<UserReviewStatsListDto> {
        return this.adminService.getUserReviewStats();
    }

    // ============================================
    // REVIEW ACTIVITY OVER TIME
    // ============================================
    @Get('reviews/activity')
    @ApiOperation({
        summary: 'Review activity timeline',
        description:
            'Returns the number of questions reviewed per day for the last N days (default 30).',
    })
    @ApiQuery({
        name: 'days',
        required: false,
        type: Number,
        description: 'Number of days to look back (default 30)',
    })
    async getReviewActivity(
        @Query('days') days?: string,
    ): Promise<ReviewActivityResponseDto> {
        return this.adminService.getReviewActivity(
            days ? parseInt(days) : 30,
        );
    }

    // ============================================
    // QUESTION BREAKDOWN
    // ============================================
    @Get('questions/breakdown')
    @ApiOperation({
        summary: 'Question breakdown',
        description:
            'Returns detailed question statistics: total, by difficulty, by source type, by source, by subject, by topic, by system, and published vs unpublished.',
    })
    async getQuestionBreakdown(): Promise<QuestionBreakdownDto> {
        return this.adminService.getQuestionBreakdown();
    }

    // ============================================
    // SUBJECTS (for generation dropdown)
    // ============================================
    @Get('questions/subjects')
    @ApiOperation({
        summary: 'Get all subjects for question generation',
        description:
            'Returns all subjects with their associated topics. Used to populate the subject dropdown in the question generation UI.',
    })
    @ApiQuery({
        name: 'includeTopics',
        required: false,
        type: Boolean,
        description: 'Include topics with question counts in each subject',
    })
    async getSubjects(
        @Query('includeTopics') includeTopics?: string,
    ): Promise<SubjectOptionDto[]> {
        const subjects = await this.questionsService.getSubjectsWithTopics(
            includeTopics !== 'false',
        );
        return subjects.map((s: any) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            ...(s.topics
                ? {
                      topics: s.topics.map((t: any) => ({
                          topicId: t.id,
                          topic: t.name,
                          questionCount: t.questionCount || 0,
                      })),
                  }
                : {}),
        })) as any;
    }

    // ============================================
    // TOPICS (for generation dropdown)
    // ============================================
    @Get('questions/topics')
    @ApiOperation({
        summary: 'Get all topics for question generation',
        description:
            'Returns all topics with question counts. Optionally filter by subjectId. Used to populate the topic dropdown in the question generation UI.',
    })
    @ApiQuery({
        name: 'subjectId',
        required: false,
        type: String,
        description: 'Filter topics by subject ID',
    })
    async getTopics(
        @Query('subjectId') subjectId?: string,
    ): Promise<{ topics: TopicOptionDto[]; totalTopics: number; totalQuestionsCount: number }> {
        return this.questionsService.getTopics(subjectId);
    }

    // ============================================
    // GENERATE QUESTIONS (AI)
    // ============================================
    @Post('questions/generate')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Generate AI questions',
        description:
            'Uses RAG (ChromaDB + LLM) to generate USMLE-style questions based on topic, difficulty, and question type. Returns newly created questions. This is the admin-facing endpoint for the question generation tab.',
    })
    async generateQuestions(
        @Body() dto: GenerateQuestionsDto,
    ): Promise<GenerateQuestionsResponseDto> {
        return this.questionGenerationService.generateQuestions(dto);
    }
    // ============================================
    // UPDATE USER ROLE
    // ============================================
    @Patch("users/:id/role")
    @ApiOperation({
        summary: "Update user role",
        description:
            "Changes the role of a user. Only accessible by admin users. Valid roles: STUDENT, REVIEWER, ADMIN.",
    })
    async updateUserRole(
        @Param("id") id: string,
        @Body() dto: UpdateUserRoleDto,
    ): Promise<UpdateUserRoleResponseDto> {
        return this.adminService.updateUserRole(id, dto);
    }

}