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
    UploadedFile,
    UseInterceptors,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { QuestionsService } from './questions.service';
import { QuestionGenerationService } from './question-generation.service';
import { GenerateQuestionsDto } from './dto/request.dto';
import { GenerateQuestionsResponseDto, QuestionResponseDto } from './dto/response.dto';
import { ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';

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
    // NEW: Import JSON file endpoint
    // ============================================
    @Post('import')
    @UseInterceptors(FileInterceptor('file'))
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
                sourceType: {
                    type: 'string',
                    enum: ['BUZZWORD', 'VIGNETTE'],
                    description: 'Type of questions being imported',
                },
                sourceFile: {
                    type: 'string',
                    description: 'Original source file name',
                },
            },
        },
    })
    @HttpCode(HttpStatus.CREATED)
    async importQuestions(
        @UploadedFile() file: any,
        @Body('sourceType') sourceType?: string,
        @Body('sourceFile') sourceFile?: string,
    ): Promise<{
        success: boolean;
        message: string;
        imported: number;
        failed: number;
        errors?: string[];
    }> {
        if (!file) {
            throw new BadRequestException('No file uploaded');
        }

        // Validate file type
        const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
        if (fileExtension !== 'json') {
            throw new BadRequestException('Only JSON files are allowed');
        }

        // Parse JSON from buffer
        let questions: any[];
        try {
            const fileContent = file.buffer.toString('utf-8');
            questions = JSON.parse(fileContent);
        } catch (error: any) {
            throw new BadRequestException(`Invalid JSON format: ${error.message}`);
        }

        // Validate it's an array
        if (!Array.isArray(questions)) {
            throw new BadRequestException('JSON must contain an array of questions');
        }

        if (questions.length === 0) {
            throw new BadRequestException('JSON array is empty');
        }

        // Determine source type from body or detect from first question
        const detectedSourceType = sourceType || questions[0]?.sourceType || 'VIGNETTE';
        const detectedSourceFile = sourceFile || file.originalname;

        // Import questions
        const result = await this.questionsService.importQuestions(
            questions,
            detectedSourceType as 'BUZZWORD' | 'VIGNETTE',
            detectedSourceFile,
        );

        return {
            success: true,
            message: `Import completed: ${result.imported} questions imported, ${result.failed} failed`,
            imported: result.imported,
            failed: result.failed,
            errors: result.errors,
        };
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