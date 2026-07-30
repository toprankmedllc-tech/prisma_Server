import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Param,
    Query,
    Body,
    HttpCode,
    HttpStatus,
    BadRequestException,
    UseGuards,
    Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { QuestionsService } from './questions.service';
import { QuestionGenerationService } from './question-generation.service';
import { GenerateQuestionsDto, ReviewQuestionDto, CreateQualityReviewDto, UnpublishByDisciplineDto } from './dto/request.dto';
import { GenerateQuestionsResponseDto, QuestionResponseDto, QuestionDetailDto, ReviewDashboardItemDto } from './dto/response.dto';
import { ApiQuery, ApiCookieAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface RequestWithUser extends Request {
    user: {
        id: string;
        email: string;
    };
}

import { SubjectResponseDto } from './dto/response.dto';

@ApiTags('Questions')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('questions')
export class QuestionsController {
    constructor(
        private readonly questionsService: QuestionsService,
        private readonly questionGenerationService: QuestionGenerationService,
    ) { }

   

    @Post('generate')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Generate AI questions', description: 'Uses RAG (ChromaDB + LLM) to generate USMLE-style questions based on topic, difficulty, and question type. Returns newly created questions.' })
    async generateQuestions(@Body() dto: GenerateQuestionsDto): Promise<GenerateQuestionsResponseDto> {
        return this.questionGenerationService.generateQuestions(dto);
    }

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
    // ENHANCED: Get all questions with more filters
    // ============================================
    @Get()
    @ApiOperation({ summary: 'List all questions', description: 'Paginated list of all questions with extensive filters (topic, difficulty, source, system, discipline, cognitive level, tag, search). Supports sorting and pagination.' })
    @ApiQuery({ name: 'topic', required: false, type: String })
    @ApiQuery({ name: 'topicId', required: false, type: String })
    @ApiQuery({ name: 'difficulty', required: false, type: String })
    @ApiQuery({ name: 'source', required: false, type: String })
    @ApiQuery({ name: 'sourceType', required: false, type: String, enum: ['BUZZWORD', 'VIGNETTE'] })
    @ApiQuery({ name: 'system', required: false, type: String })
    @ApiQuery({ name: 'discipline', required: false, type: String })
    @ApiQuery({ name: 'cognitiveLevel', required: false, type: String })
    @ApiQuery({ name: 'trapType', required: false, type: String })
    @ApiQuery({ name: 'tag', required: false, type: String })
    @ApiQuery({ name: 'search', required: false, type: String, description: 'Search in stem and explanation' })
    @ApiQuery({ name: 'isPublished', required: false, type: Boolean })
    @ApiQuery({ name: 'skip', required: false, type: Number })
    @ApiQuery({ name: 'take', required: false, type: Number })
    @ApiQuery({ name: 'sortBy', required: false, type: String, enum: ['createdAt', 'difficulty', 'sourceType', 'topic'] })
    @ApiQuery({ name: 'sortOrder', required: false, type: String, enum: ['asc', 'desc'] })
    async findAll(
        @Query('topic') topic?: string,
        @Query('topicId') topicId?: string,
        @Query('difficulty') difficulty?: string,
        @Query('source') source?: string,
        @Query('sourceType') sourceType?: string,
        @Query('system') system?: string,
        @Query('discipline') discipline?: string,
        @Query('cognitiveLevel') cognitiveLevel?: string,
        @Query('trapType') trapType?: string,
        @Query('tag') tag?: string,
        @Query('search') search?: string,
        @Query('isPublished') isPublished?: string,
        @Query('skip') skip?: string,
        @Query('take') take?: string,
        @Query('sortBy') sortBy?: string,
        @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    ): Promise<{
        data: QuestionResponseDto[];
        total: number;
        page: number;
        limit: number;
    }> {
        return this.questionsService.findAllEnhanced({
            topic,
            topicId,
            difficulty,
            source,
            sourceType,
            system,
            discipline,
            cognitiveLevel,
            trapType,
            tag,
            search,
            isPublished: isPublished ? isPublished === 'true' : undefined,
            skip: skip ? parseInt(skip) : undefined,
            take: take ? parseInt(take) : undefined,
            sortBy: sortBy as any,
            sortOrder: sortOrder || 'desc',
        });
    }

    // ============================================
    // SUBJECTS & TOPICS: Get all subjects with their topics
    // ============================================
    @Get('subjects')
    @ApiOperation({ summary: 'Get all subjects', description: 'Returns all subjects. When includeTopics=true (default), includes topics with question counts.' })
    @ApiQuery({ name: 'includeTopics', required: false, type: Boolean, description: 'Include topics with question Count in each topic ' })
    async getSubjects(
        @Query('includeTopics') includeTopics?: string,
    ): Promise<SubjectResponseDto[]> {
        return this.questionsService.getSubjectsWithTopics(includeTopics !== 'false');
    }

    // ============================================
    // TOPICS: Get all topics (optionally filtered by subject)
    // ============================================


    @Get('topics')
    @ApiOperation({ summary: 'Get all topics', description: 'Returns all topics with their question counts. Optionally filter by subjectId. Returns array of { topicId, topic, questionCount }.' })
    @ApiQuery({ name: 'subjectId', required: false, type: String, description: 'Filter topics by subject ID' })
    async getTopics(
        @Query('subjectId') subjectId?: string,
    ): Promise<{ totalTopics: number; totalQuestionsCount: number ; topics: { topicId: string; topic: string; questionCount: number }[];  }> {
        return this.questionsService.getTopics(subjectId);
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
    // @Patch(':id/publish')
    // @ApiOperation({ summary: 'Publish a question', description: 'Sets isPublished to true. Use after quality review is complete to make the question visible to students.' })
    // async publish(@Param('id') id: string): Promise<QuestionResponseDto> {
    //     return this.questionsService.publishQuestion(id);
    // }

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
        return this.questionsService.reviewQuestion(id, { ...dto, reviewedBy:  req.user.id });
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
    @ApiOperation({ summary: 'Save quality review', description: 'Saves or updates the quality review for a question (medical accuracy, USMLE style, explanation quality, etc.). After saving, the question is automatically published.' })
    async saveQualityReview(
        @Param('id') id: string,
        @Body() dto: CreateQualityReviewDto,
    ) {
        return this.questionsService.saveQualityReview(id, dto);
    }

    // ============================================
    // UNPUBLISH: Unpublish all questions by discipline
    // ============================================
    // @Post('unpublish-by-discipline')
    // @HttpCode(HttpStatus.OK)
    // @ApiOperation({ summary: 'Unpublish by discipline', description: 'Bulk unpublishes all published questions under a given discipline (e.g. Cardiology, Neurology). Sets isPublished=false and reviewed=false.' })
    // async unpublishByDiscipline(
    //     @Body() dto: UnpublishByDisciplineDto,
    // ): Promise<{ count: number }> {
    //     return this.questionsService.unpublishByDiscipline(dto.discipline);
    // }

    // @Delete(':id')
    // @HttpCode(HttpStatus.NO_CONTENT)
    // @ApiOperation({ summary: 'Delete a question', description: 'Permanently deletes a question and all its related data (choices, wrong options, vitals, quality review, tags).' })
    // async delete(@Param('id') id: string): Promise<void> {
    //     return this.questionsService.deleteQuestion(id);
    // }

    // ============================================
    // BULK DELETE: Bulk delete endpoint
    // ============================================
    // @Post('bulk-delete')
    // @HttpCode(HttpStatus.NO_CONTENT)
    // @ApiOperation({ summary: 'Bulk delete questions', description: 'Permanently deletes multiple questions by their IDs. Accepts an array of question IDs in the request body.' })
    // async bulkDelete(@Body('ids') ids: string[]): Promise<void> {
    //     if (!ids || !Array.isArray(ids) || ids.length === 0) {
    //         throw new BadRequestException('Please provide an array of question IDs');
    //     }
    //     return this.questionsService.bulkDeleteQuestions(ids);
    // }

    // ============================================
    // STATS: Get statistics endpoint
    // ============================================
    @Get('stats/summary')
    @ApiOperation({ summary: 'Question statistics', description: 'Returns aggregate statistics: total count, breakdown by difficulty, source type, source, system, subject, topic, and published vs unpublished counts.' })
    async getStats(): Promise<{
        total: number;
        byDifficulty: Record<string, number>;
        bySourceType: Record<string, number>;
        bySource: Record<string, number>;
        bySystem: Record<string, number>;
        bySubject: Record<string, number>;
        byTopic: Record<string, number>;
        published: number;
        unpublished: number;
    }> {
        return this.questionsService.getQuestionStats();
    }
}