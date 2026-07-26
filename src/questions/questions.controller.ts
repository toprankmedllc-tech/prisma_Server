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
} from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { QuestionGenerationService } from './question-generation.service';
import { GenerateQuestionsDto, ReviewQuestionDto, CreateQualityReviewDto, UnpublishByDisciplineDto } from './dto/request.dto';
import { GenerateQuestionsResponseDto, QuestionResponseDto } from './dto/response.dto';
import { ApiQuery } from '@nestjs/swagger';

@Controller('questions')
export class QuestionsController {
    constructor(
        private readonly questionsService: QuestionsService,
        private readonly questionGenerationService: QuestionGenerationService,
    ) { }

    @Post('generate')
    @HttpCode(HttpStatus.CREATED)
    async generateQuestions(@Body() dto: GenerateQuestionsDto): Promise<GenerateQuestionsResponseDto> {
        return this.questionGenerationService.generateQuestions(dto);
    }

    // ============================================
    // ENHANCED: Get all questions with more filters
    // ============================================
    @Get()
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

    @Get(':id')
    async findOne(@Param('id') id: string): Promise<QuestionResponseDto> {
        return this.questionsService.findOne(id);
    }

    @Patch(':id/publish')
    async publish(@Param('id') id: string): Promise<QuestionResponseDto> {
        return this.questionsService.publishQuestion(id);
    }

    // ============================================
    // NEW: Review a question (approve or add notes)
    // ============================================
    @Patch(':id/review')
    async review(
        @Param('id') id: string,
        @Body() dto: ReviewQuestionDto,
    ): Promise<QuestionResponseDto> {
        return this.questionsService.reviewQuestion(id, dto);
    }

    // ============================================
    // NEW: Save / update quality review for a question
    // ============================================
    @Patch(':id/quality-review')
    async saveQualityReview(
        @Param('id') id: string,
        @Body() dto: CreateQualityReviewDto,
    ) {
        return this.questionsService.saveQualityReview(id, dto);
    }

    // ============================================
    // NEW: Unpublish all questions by discipline
    // ============================================
    @Post('unpublish-by-discipline')
    @HttpCode(HttpStatus.OK)
    async unpublishByDiscipline(
        @Body() dto: UnpublishByDisciplineDto,
    ): Promise<{ count: number }> {
        return this.questionsService.unpublishByDiscipline(dto.discipline);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async delete(@Param('id') id: string): Promise<void> {
        return this.questionsService.deleteQuestion(id);
    }

    // ============================================
    // NEW: Bulk delete endpoint
    // ============================================
    @Post('bulk-delete')
    @HttpCode(HttpStatus.NO_CONTENT)
    async bulkDelete(@Body('ids') ids: string[]): Promise<void> {
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            throw new BadRequestException('Please provide an array of question IDs');
        }
        return this.questionsService.bulkDeleteQuestions(ids);
    }

    // ============================================
    // NEW: Get statistics endpoint
    // ============================================
    @Get('stats/summary')
    async getStats(): Promise<{
        total: number;
        byDifficulty: Record<string, number>;
        bySourceType: Record<string, number>;
        bySource: Record<string, number>;
        bySystem: Record<string, number>;
        byDiscipline: Record<string, number>;
        published: number;
        unpublished: number;
    }> {
        return this.questionsService.getQuestionStats();
    }
}