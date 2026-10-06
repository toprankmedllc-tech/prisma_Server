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
import { ApiCookieAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../admin/admin.guard';
import { QuestionsService } from '../questions/questions.service';
import {
    QuestionDetailDto,
    QuestionResponseDto,
    ReviewDashboardItemDto,
} from '../questions/dto/response.dto';
import {
    CreateQualityReviewDto,
    ReviewQuestionDto,
    UpdateQuestionDto,
} from '../questions/dto/request.dto';

interface RequestWithUser extends Request {
    user: {
        id: string;
        email: string;
    };
}

@ApiTags('Human Review')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('human-review')
export class ReviewController {
    constructor(private readonly questionsService: QuestionsService) {}

    // ============================================
    // REVIEW DASHBOARD: Get random questions by subject/topic
    // ============================================
    @Get('review-dashboard')
        @ApiOperation({ summary: 'Review dashboard', description: 'Returns up to 20 random questions filtered by subject/topic for reviewer selection. Excludes questions the user has already reviewed or skipped. Used as the entry point for the review workflow.' })
        @ApiQuery({ name: 'subject', required: false, type: String, description: 'Filter by subject name' })
        @ApiQuery({ name: 'topic', required: false, type: String, description: 'Filter by topic name' })
        @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max questions to return (default 20)' })
        async getReviewDashboard(
            @Req() req: RequestWithUser,
            @Query('subject') subject?: string,
            @Query('topic') topic?: string,
            @Query('limit') limit?: string,
        ): Promise<ReviewDashboardItemDto[]> {
            return this.questionsService.getReviewDashboardQuestions({
                userId: req.user.id,
                subject,
                topic,
                limit: limit ? parseInt(limit) : 20,
            });
        }

    // ============================================
    // REVIEWED: Get questions reviewed by the current user
    // ============================================
    @Get('reviewed')
        @ApiOperation({ summary: 'Get reviewed questions', description: 'Returns paginated list of questions the current user has reviewed (approved or rejected). Ordered by most recently reviewed first.' })
        @ApiQuery({ name: 'skip', required: false, type: Number, description: 'Number of records to skip (default 0)' })
        @ApiQuery({ name: 'take', required: false, type: Number, description: 'Number of records to take (default 50)' })
        async getReviewedQuestions(
            @Req() req: RequestWithUser,
            @Query('skip') skip?: string,
            @Query('take') take?: string,
        ): Promise<{
            data: ReviewDashboardItemDto[];
            total: number;
            page: number;
            limit: number;
        }> {
            return this.questionsService.getReviewedQuestionsByUser(req.user.id, {
                skip: skip ? parseInt(skip) : undefined,
                take: take ? parseInt(take) : undefined,
            });
        }

    // ============================================
    // SKIPPED: Get questions skipped by the current user
    // ============================================
    @Get('skipped')
        @ApiOperation({ summary: 'Get skipped questions', description: 'Returns paginated list of questions the current user has skipped. Ordered by most recently skipped first.' })
        @ApiQuery({ name: 'skip', required: false, type: Number, description: 'Number of records to skip (default 0)' })
        @ApiQuery({ name: 'take', required: false, type: Number, description: 'Number of records to take (default 50)' })
        async getSkippedQuestions(
            @Req() req: RequestWithUser,
            @Query('skip') skip?: string,
            @Query('take') take?: string,
        ): Promise<{
            data: ReviewDashboardItemDto[];
            total: number;
            page: number;
            limit: number;
        }> {
            return this.questionsService.getSkippedQuestionsByUser(req.user.id, {
                skip: skip ? parseInt(skip) : undefined,
                take: take ? parseInt(take) : undefined,
            });
        }

    // ============================================
    // USER PREFERENCES: Get user's preferred subjects for review assignment
    // ============================================
    @Get('preferences')
        @ApiOperation({ summary: 'Get user preferences', description: 'Returns the user\'s preferred subjects for question assignment in the review dashboard.' })
        async getUserPreferences(
            @Req() req: RequestWithUser,
        ): Promise<{ preferredSubjects: string[] }> {
            return this.questionsService.getUserPreferences(req.user.id);
        }

    // ============================================
    // USER PREFERENCES: Update user's preferred subjects
    // ============================================
    @Patch('preferences')
        @ApiOperation({ summary: 'Update user preferences', description: 'Saves the user\'s preferred subjects for question assignment.' })
        async updateUserPreferences(
            @Req() req: RequestWithUser,
            @Body() body: { preferredSubjects: string[] },
        ): Promise<{ preferredSubjects: string[] }> {
            return this.questionsService.updateUserPreferences(req.user.id, body.preferredSubjects);
        }

    // // ============================================
    // // ASSIGN: Assign 20 questions to the user exclusively
    // // ============================================
    // @Post('assign')
    //     @ApiOperation({ summary: 'Assign questions to user', description: 'Finds 20 unassigned questions matching the user\'s preferred subjects and locks them exclusively to this user. Other reviewers will not get these questions.' })
    //     async assignQuestions(
    //         @Req() req: RequestWithUser,
    //         @Body() body: { subjects?: string[] },
    //     ): Promise<ReviewDashboardItemDto[]> {
    //         return this.questionsService.assignQuestionsToUser(req.user.id, body.subjects);
    //     }

    // ============================================
    // REVIEW: Get full question with less details
    // ============================================
    @Get(':id')
        @ApiOperation({ summary: 'Get question by ID with limited details', description: 'Returns a single question with its choices, tags, and topic. Does not include wrong options, vitals, or quality review.' })
        async findOne(@Param('id') id: string): Promise<QuestionResponseDto> {
            return this.questionsService.findOneQuestion(id);
        }

    // ============================================
    // REVIEW: Get full question detail for review
    // ============================================
    @Get(':id/detail')
        @ApiOperation({ summary: 'Get full question by ID with all details', description: 'Returns complete question data with all nested relations: choices, wrong options, vitals, quality review, tags, topic, and subject. Used for the review detail view.' })
        async findDetail(@Param('id') id: string): Promise<QuestionDetailDto> {
            return this.questionsService.findFullDetail(id);
        }

    
    // ============================================
    // REVIEW: Review a question (approve, reject, or add notes)
    // ============================================
    @Patch(':id/review')
        @ApiOperation({ summary: 'Review a question', description: 'Mark a question as reviewed (approve or reject). Set  rejected=false to approve. Set rejected=true to reject. Returns full question detail after u set rejected = false  after that  send quality review data via another api below to publish the question .It is not necessary to send reviewedBy through body , in the backend it takes userId from cookies so that we can keep track of the  who reviewed the question .' })
        async review(
            @Req() req: RequestWithUser,
            @Param('id') id: string,
            @Body() dto: ReviewQuestionDto,
        ): Promise<QuestionDetailDto> {
            return this.questionsService.reviewQuestion(id, { ...dto, reviewedBy: req.user.id });
        }

    // ============================================
    // SKIP REVIEW: Add a question to the user's skip list
    // ============================================
    @Post(':id/skip-review')
        @HttpCode(HttpStatus.OK)
        @ApiOperation({ summary: 'Skip a question', description: 'Adds the question to the user\'s skipped list so it will not appear in future review dashboard queries. send only questionId in the param.  ' })
        async skipReview(
            @Req() req: RequestWithUser,
            @Param('id') id: string,
        ): Promise<{ skipped: boolean }> {
            await this.questionsService.markQuestionAsSkipped(req.user.id, id);
            return { skipped: true };
        }

    // ============================================
    // QUALITY REVIEW: Save / update quality review for a question
    // ============================================
    @Patch(':id/quality-review')
        @UseGuards(AdminGuard)
        @ApiOperation({ summary: 'Complete quality review and publish', description: 'Requires prior human approval. Saves the quality review and publishes the question as the final controlled publication step.' })
        async saveQualityReview(
            @Req() req: RequestWithUser,
            @Param('id') id: string,
            @Body() dto: CreateQualityReviewDto,
        ) {
            return this.questionsService.saveQualityReview(id, { ...dto, reviewedBy: req.user.id });
        }
}