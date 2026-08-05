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
    UseGuards,
    Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiQuery, ApiCookieAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
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
import { DocumentsService } from '../documents/documents.service';
import { DocumentIngestionService } from '../documents/documents-ingestion.service';
import { DocumentResponseDto, DocumentDetailResponseDto, DocumentIngestionResultDto } from '../documents/dto/document-response.dto';
import { UploadDocumentDto, ReingestDocumentDto } from '../documents/dto/upload-document.dto';
import { QuestionQueueService } from '../question-queue/question-queue.service';

interface RequestWithUser extends Request {
    user: {
        id: string;
        email: string;
    };
}

@ApiTags('Admin')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
    constructor(
        private readonly adminService: AdminService,
        private readonly questionsService: QuestionsService,
        private readonly questionGenerationService: QuestionGenerationService,
        private readonly documentsService: DocumentsService,
        private readonly documentIngestionService: DocumentIngestionService,
        private readonly questionQueueService: QuestionQueueService,
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
    // GENERATE QUESTIONS (AI) - SYNC (original)
    // ============================================
    @Post('questions/generate')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Generate AI questions (sync)',
        description:
            'Uses RAG (ChromaDB + LLM) to generate USMLE-style questions based on topic, difficulty, and question type. Returns newly created questions. This is the admin-facing endpoint for the question generation tab.',
    })
    async generateQuestions(
        @Body() dto: GenerateQuestionsDto,
    ): Promise<GenerateQuestionsResponseDto> {
        return this.questionGenerationService.generateQuestions(dto);
    }

    // ============================================
    // GENERATE QUESTIONS (AI) - ASYNC (queue-based)
    // ============================================
    @Post('questions/generate-async')
    @HttpCode(HttpStatus.ACCEPTED)
    @ApiOperation({
        summary: 'Queue AI question generation (async)',
        description:
            'Queues a question generation job in the background using BullMQ. Returns a job ID immediately. The frontend can use Socket.IO to listen for completion events on "generation:completed" with the jobId and generated question IDs.',
    })
    async generateQuestionsAsync(
        @Req() req: RequestWithUser,
        @Body() dto: GenerateQuestionsDto,
    ): Promise<{
        jobId: string;
        status: string;
        message: string;
    }> {
        return this.questionQueueService.queueGeneration(dto, req.user.id);
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

    // ============================================
    // QUEUE DASHBOARD: Redis connection status & queue metrics
    // ============================================
    @Get('queue/status')
    @ApiOperation({
        summary: 'Redis connection status & queue metrics',
        description:
            'Returns whether Redis is connected and the current BullMQ queue job counts (waiting, active, completed, failed, delayed).',
    })
    async getQueueStatus(): Promise<{
        redisConnected: boolean;
        queueMetrics: {
            waiting: number;
            active: number;
            completed: number;
            failed: number;
            delayed: number;
        };
    }> {
        return this.questionQueueService.getQueueMetrics();
    }

    // ============================================
    // QUEUE DASHBOARD: Get all generation jobs (admin view)
    // ============================================
    @Get('queue/jobs')
    @ApiOperation({
        summary: 'Get all generation jobs (admin view)',
        description:
            'Returns all question generation jobs across all users, ordered by most recent first. Supports pagination and status filtering.',
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        type: Number,
        description: 'Number of jobs to return (default 50)',
    })
    @ApiQuery({
        name: 'offset',
        required: false,
        type: Number,
        description: 'Number of jobs to skip (default 0)',
    })
    @ApiQuery({
        name: 'status',
        required: false,
        type: String,
        description: 'Filter by status: queued, processing, completed, failed',
    })
    async getAllGenerationJobs(
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
        @Query('status') status?: string,
    ): Promise<{
        jobs: Array<{
            id: string;
            userId: string | null;
            status: string;
            params: any;
            questionIds: string[];
            questionCount: number;
            errorMessage: string | null;
            createdAt: Date;
            updatedAt: Date;
        }>;
        total: number;
    }> {
        return this.questionQueueService.getAllJobs(
            limit ? parseInt(limit) : 50,
            offset ? parseInt(offset) : 0,
            status,
        );
    }

    // ============================================
    // QUEUE DASHBOARD: Get BullMQ jobs by status
    // ============================================
    @Get('queue/jobs/:status')
    @ApiOperation({
        summary: 'Get BullMQ jobs by status',
        description:
            'Returns BullMQ jobs directly from Redis for the given status (waiting, active, completed, failed, delayed). Includes detailed job info like attempts, timestamps, and error stacktraces.',
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        type: Number,
        description: 'Number of jobs to return (default 20)',
    })
    async getBullJobsByStatus(
        @Param('status') status: string,
        @Query('limit') limit?: string,
    ): Promise<Array<{
        bullJobId: string | number | undefined;
        generationJobId: string;
        status: string;
        data: any;
        failedReason?: string;
        stacktrace?: string[];
        processedOn?: string;
        finishedOn?: string;
        createdAt?: string;
        attemptsMade: number;
    }>> {
        return this.questionQueueService.getBullJobsByStatus(
            status as any,
            limit ? parseInt(limit) : 20,
        );
    }

    // ============================================
    // DOCUMENT MANAGEMENT (ingestion pipeline)
    // ============================================

    @Get('documents')
    @ApiOperation({
        summary: 'List all ingested documents',
        description:
            'Returns all documents in the ingestion pipeline with their status, chunk count, and chunking configuration.',
    })
    async getDocuments(): Promise<DocumentResponseDto[]> {
        return this.documentsService.findAll();
    }

    @Get('documents/:id')
    @ApiOperation({
        summary: 'Get document details with chunks',
        description:
            'Returns a single document with its full content and all chunks for review.',
    })
    async getDocumentDetail(
        @Param('id') id: string,
    ): Promise<DocumentDetailResponseDto> {
        return this.documentsService.findOne(id);
    }

    @Post('documents')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Ingest a document (markdown/text/HTML)',
        description:
            'Creates a document record, chunks it using the specified strategy, and ingests into ChromaDB for RAG-based question generation.',
    })
    async ingestDocument(
        @Body() dto: UploadDocumentDto,
    ): Promise<DocumentIngestionResultDto> {
        const document = await this.documentsService.create(dto);
        const config = dto.chunkingConfig || {};
        await this.documentIngestionService.ingestDocument(
            document.id,
            dto.content,
            config,
            dto.title,
        );
        const updated = await this.documentsService.findOne(document.id);
        return {
            id: updated.id,
            title: updated.title,
            status: updated.status,
            chunkCount: updated.chunks.length,
            message: `Document "${dto.title}" ingested successfully (${updated.chunks.length} chunks)`,
        };
    }

    @Patch('documents/:id/reingest')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Re-ingest a document with new chunking rules',
        description:
            'Deletes existing chunks and re-chunks/re-embeds the document. Useful after changing chunking rules.',
    })
    async reingestDocument(
        @Param('id') id: string,
        @Body() dto: ReingestDocumentDto,
    ): Promise<DocumentIngestionResultDto> {
        const result = await this.documentIngestionService.reingestDocument(
            id,
            dto.chunkingConfig,
        );
        const updated = await this.documentsService.findOne(id);
        return {
            id: updated.id,
            title: updated.title,
            status: updated.status,
            chunkCount: updated.chunks.length,
            message: `Document re-ingested successfully (${updated.chunks.length} chunks)`,
        };
    }

    @Delete('documents/:id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: 'Delete a document from the pipeline',
        description:
            'Deletes a document and its chunks from both PostgreSQL and ChromaDB.',
    })
    async deleteDocument(
        @Param('id') id: string,
    ): Promise<void> {
        return this.documentsService.delete(id);
    }
}

