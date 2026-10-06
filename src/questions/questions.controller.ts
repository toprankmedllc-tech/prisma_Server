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
import { GenerateQuestionsDto, ReviewQuestionDto, CreateQualityReviewDto, UnpublishByDisciplineDto, UpdateQuestionDto } from './dto/request.dto';
import { GenerateQuestionsResponseDto, QuestionResponseDto, QuestionDetailDto, ReviewDashboardItemDto } from './dto/response.dto';
import { ApiQuery, ApiCookieAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QuestionQueueService } from '../question-queue/question-queue.service';
import { AdminGuard } from '../admin/admin.guard';

interface RequestWithUser extends Request {
    user: {
        id: string;
        email: string;
    };
}

import { DisciplineResponseDto } from './dto/response.dto';

@ApiTags('Questions Filter & Summary !')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('questions')
export class QuestionsController {
    constructor(
        private readonly questionsService: QuestionsService,
        private readonly questionGenerationService: QuestionGenerationService,
        private readonly questionQueueService: QuestionQueueService,
    ) { }



    // @Post('generate')
    // @HttpCode(HttpStatus.CREATED)
    // @ApiOperation({ summary: '(Deprecated) Generate AI questions synchronously', description: 'Uses RAG (ChromaDB + LLM) to generate USMLE-style questions based on topic, difficulty, and question type. This endpoint blocks until generation is complete. For large generation, use the async endpoint instead.' })
    // async generateQuestions(@Body() dto: GenerateQuestionsDto): Promise<GenerateQuestionsResponseDto> {
    //     return this.questionGenerationService.generateQuestions(dto);
    // }

    // ============================================
    // ASYNC QUESTION GENERATION (queue-based)
    // ============================================
    // @Post('generate-async')
    // @HttpCode(HttpStatus.ACCEPTED)
    // @ApiOperation({
    //     summary: 'Queue AI question generation (async)',
    //     description: 'Queues a question generation job in the background using BullMQ. Returns a job ID immediately. The frontend can use Socket.IO to listen for completion events on "generation:completed" with the jobId and generated question IDs.',
    // })
    // async generateQuestionsAsync(
    //     @Req() req: RequestWithUser,
    //     @Body() dto: GenerateQuestionsDto,
    // ): Promise<{
    //     jobId: string;
    //     status: string;
    //     message: string;
    // }> {
    //     return this.questionQueueService.queueGeneration(dto, req.user.id);
    // }
    // ============================================
    // GET QUEUE JOB STATUS
    // ============================================
    // @Get('generate-async/:jobId')
    // @ApiOperation({
    //     summary: 'Get generation job status',
    //     description: 'Returns the current status of an async question generation job. Use this to poll for status if not using Socket.IO.',
    // })
    // async getGenerationJobStatus(
    //     @Param('jobId') jobId: string,
    // ): Promise<{
    //     id: string;
    //     status: string;
    //     params: any;
    //     questionIds: string[];
    //     questionCount: number;
    //     errorMessage: string | null;
    //     createdAt: Date;
    //     updatedAt: Date;
    // } | null> {
    //     return this.questionQueueService.getJobStatus(jobId);
    // }
    // ============================================
    // GET USER'S GENERATION JOBS
    // ============================================
    // @Get('generate-async/jobs/mine')
    // @ApiOperation({
    //     summary: 'Get my generation jobs',
    //     description: 'Returns the current user\'s recent question generation jobs, ordered by most recent first.',
    // })
    // async getMyGenerationJobs(
    //     @Req() req: RequestWithUser,
    // ): Promise<Array<{
    //     id: string;
    //     status: string;
    //     questionCount: number;
    //     questionIds: string[];
    //     errorMessage: string | null;
    //     createdAt: Date;
    // }>> {
    //     return this.questionQueueService.getUserJobs(req.user.id);
    // }

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
    // EDIT: Preserve a revision before applying admin changes
    // ============================================
    @Patch(':id/edit')
    @UseGuards(AdminGuard)
    @ApiOperation({ summary: 'Edit a question', description: 'Updates question content, creates an immutable pre-edit revision, invalidates prior approval, and leaves the question unpublished.' })
    async editQuestion(
        @Req() req: RequestWithUser,
        @Param('id') id: string,
        @Body() dto: UpdateQuestionDto,
    ): Promise<QuestionDetailDto> {
        return this.questionsService.updateQuestion(id, dto, req.user.id);
    }


    // ============================================
    // SYSTEMS: Get all distinct organ systems from questions
    // ============================================
    @Get('systems')
    @ApiOperation({ summary: 'Get all organ systems', description: 'Returns all distinct organ system values found in the Question table.' })
    async getSystems(): Promise<{ systems: string[] }> {
        return this.questionsService.getSystems();
    }

    // ============================================
    // DISCIPLINES: Get all disciplines with their topics
    // ============================================
    @Get('disciplines')
    @ApiOperation({ summary: 'Get all disciplines', description: 'Returns all disciplines with their topics and question counts.' })
    async getDisciplines(): Promise<any[]> {
        return this.questionsService.getDisciplinesWithTopics();
    }

    // ============================================
    // SUBJECTS & TOPICS: Get all subjects with their topics
    // ============================================
    @Get('subjects')
    @ApiOperation({ summary: 'Get all disciplines', description: 'Returns all disciplines. When includeTopics=true (default), includes topics with question counts.' })
    @ApiQuery({ name: 'includeTopics', required: false, type: Boolean, description: 'Include topics with question Count in each topic ' })
    async getSubjects(
        @Query('includeTopics') includeTopics?: string,
    ): Promise<DisciplineResponseDto[]> {
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
    ): Promise<{ totalTopics: number; totalQuestionsCount: number; topics: { topicId: string; topic: string; questionCount: number }[]; }> {
        return this.questionsService.getTopics(subjectId);
    }

    // ============================================
    // SUBJECTS BY SYSTEM: Get subjects filtered by organ system
    // ============================================
    @Get('subjects/by-system')
    @ApiOperation({ summary: 'Get subjects by organ system', description: 'Returns subjects (disciplines) that have questions in the given organ system(s). Only includes topics that have questions in those system(s).' })
    @ApiQuery({ name: 'system', required: true, type: [String], description: 'Organ system(s) to filter by (e.g. "Cardiovascular system")' })
    async getSubjectsWithTopicsBySystem(
        @Query('system') system?: string | string[],
    ): Promise<any[]> {
        const systems = system
            ? Array.isArray(system) ? system : [system]
            : [];
        return this.questionsService.getSubjectsWithTopicsBySystem(systems);
    }

    // ============================================
    // TOPICS BY SYSTEM: Get topics filtered by organ system and subject
    // ============================================
    @Get('topics/by-system')
    @ApiOperation({ summary: 'Get topics by organ system and subject', description: 'Returns topics under a given subject that have questions in the specified organ system(s).' })
    @ApiQuery({ name: 'subjectId', required: true, type: String, description: 'Subject (discipline) ID' })
    @ApiQuery({ name: 'system', required: true, type: [String], description: 'Organ system(s) to filter by' })
    async getTopicsBySystem(
        @Query('subjectId') subjectId?: string,
        @Query('system') system?: string | string[],
    ): Promise<{ topics: { topicId: string; topic: string; questionCount: number }[]; totalTopics: number; totalQuestionsCount: number }> {
        const systems = system
            ? Array.isArray(system) ? system : [system]
            : [];
        return this.questionsService.getTopicsBySystem(subjectId!, systems);
    }



    // @Patch(':id/publish')
    // @ApiOperation({ summary: 'Publish a question', description: 'Sets isPublished to true. Use after quality review is complete to make the question visible to students.' })
    // async publish(@Param('id') id: string): Promise<QuestionResponseDto> {
    //     return this.questionsService.publishQuestion(id);
    // }


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

    // ... rest of the existing controller methods ...
}
