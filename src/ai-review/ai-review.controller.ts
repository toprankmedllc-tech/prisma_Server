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
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiQuery, ApiCookieAuth } from '@nestjs/swagger';

import {
  BatchReviewQuestionsDto,
  AiReviewFilterDto,
  AiReviewResultDto,
  BatchReviewResultDto,
  AiReviewSummaryDto,
} from './dto/ai-review.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../admin/admin.guard';
import { AiReviewService } from './ai-review.service';

interface RequestWithUser extends Request {
  user: {
    id: string;
    email: string;
  };
}

@ApiTags('AI Review')
@ApiCookieAuth('access_token')
@Controller()
export class AiReviewController {
  constructor(private readonly aiReviewService: AiReviewService) {}

  // ============================================
  // REVIEW A SINGLE QUESTION (admin-only, synchronous)
  // ============================================
  @Post('admin/ai-review/review/:questionId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Review a single question with AI',
    description:
      'Runs an auditable AI quality review on a single question. AI review never publishes or replaces a question automatically; publication and replacement generation require separate controlled workflows.',
  })
  async reviewSingleQuestion(
    @Param('questionId') questionId: string,
    @Query('autoPublish') autoPublish?: string,
    @Query('autoRegenerate') autoRegenerate?: string,
  ): Promise<AiReviewResultDto> {
    if (!questionId) {
      throw new BadRequestException('questionId is required');
    }
    return this.aiReviewService.reviewQuestion(questionId, {
      autoPublish: autoPublish !== 'false',
      autoRegenerate: autoRegenerate !== 'false',
    });
  }

  // ============================================
  // BATCH REVIEW QUESTIONS (admin-only, synchronous)
  // ============================================
  @Post('admin/ai-review/batch')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Batch review multiple questions with AI',
    description:
      'Runs AI quality review on multiple questions. Provide an array of question IDs. Each question is evaluated individually. Returns a summary of PASS/FAIL results.',
  })
  async batchReviewQuestions(
    @Body() dto: BatchReviewQuestionsDto,
  ): Promise<BatchReviewResultDto> {
    if (!dto.questionIds || dto.questionIds.length === 0) {
      throw new BadRequestException('questionIds array is required and must not be empty');
    }
    return this.aiReviewService.batchReview(dto.questionIds, {
      autoPublish: dto.autoPublish !== false,
      autoRegenerate: dto.autoRegenerate !== false,
      stringent: dto.stringent ?? false,
    });
  }

  // ============================================
  // GET UNREVIEWED QUESTIONS (for admin to select for batch review)
  // ============================================
  @Get('admin/ai-review/unreviewed')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({
    summary: 'Get unreviewed questions for AI review',
    description:
      'Returns questions that have NOT been reviewed by AI yet. Filters by sourceType, difficulty, source, and limit. Useful for the admin to select which questions to submit for batch AI review.',
  })
  @ApiQuery({ name: 'sourceType', required: false, type: String, enum: ['BUZZWORD', 'VIGNETTE'] })
  @ApiQuery({ name: 'difficulty', required: false, type: String, enum: ['EASY', 'MEDIUM', 'HARD'] })
  @ApiQuery({ name: 'source', required: false, type: String, enum: ['AI_GENERATED', 'HUMAN_GENERATED', 'IMPORTED'] })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getUnreviewedQuestions(
    @Query('sourceType') sourceType?: string,
    @Query('difficulty') difficulty?: string,
    @Query('source') source?: string,
    @Query('limit') limit?: string,
  ): Promise<any[]> {
    return this.aiReviewService.getUnreviewedQuestions({
      sourceType,
      difficulty,
      source,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // ============================================
  // GET REVIEWED QUESTIONS (with AI review + full details)
  // ============================================
  @Get('admin/ai-review/reviewed')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({
    summary: 'Get reviewed questions with AI review data',
    description:
      'Returns questions that HAVE been reviewed by AI, including the AI review verdict, scores, and feedback. Also includes full question details (stem, choices, wrong options, vitals). Filters by sourceType, difficulty, source, verdict (PASS/FAIL), and limit.',
  })
  @ApiQuery({ name: 'sourceType', required: false, type: String, enum: ['BUZZWORD', 'VIGNETTE'] })
  @ApiQuery({ name: 'difficulty', required: false, type: String, enum: ['EASY', 'MEDIUM', 'HARD'] })
  @ApiQuery({ name: 'source', required: false, type: String, enum: ['AI_GENERATED', 'HUMAN_GENERATED', 'IMPORTED'] })
  @ApiQuery({ name: 'verdict', required: false, type: String, enum: ['PASS', 'FAIL'] })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getReviewedQuestions(
    @Query('sourceType') sourceType?: string,
    @Query('difficulty') difficulty?: string,
    @Query('source') source?: string,
    @Query('verdict') verdict?: 'PASS' | 'FAIL',
    @Query('limit') limit?: string,
  ): Promise<any[]> {
    return this.aiReviewService.getReviewedQuestions({
      sourceType,
      difficulty,
      source,
      verdict,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // ============================================
  // GET AI REVIEW SUMMARY STATS
  // ============================================
  @Get('admin/ai-review/summary')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({
    summary: 'Get AI review summary statistics',
    description:
      'Returns aggregate statistics for all AI reviews: total reviews, pass/fail counts, and average scores across all dimensions.',
  })
  async getReviewSummary(): Promise<AiReviewSummaryDto> {
    return this.aiReviewService.getReviewSummary();
  }

  // ============================================
  // GET AI REVIEW FOR A SPECIFIC QUESTION
  // ============================================
  @Get('questions/:questionId/ai-review')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get AI review result for a question',
    description:
      'Returns the AI review result for a specific question, including scores, feedback, and verdict. Returns null if no AI review has been performed yet.',
  })
  async getReviewForQuestion(
    @Param('questionId') questionId: string,
  ): Promise<AiReviewResultDto | null> {
    return this.aiReviewService.getReviewForQuestion(questionId);
  }

  // ============================================
  // GET COMPLETE AI REVIEW HISTORY FOR A QUESTION
  // ============================================
  @Get('questions/:questionId/ai-review/history')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get all AI review attempts for a question',
    description: 'Returns every preserved AI review attempt, newest first.',
  })
  async getReviewHistory(@Param('questionId') questionId: string): Promise<AiReviewResultDto[]> {
    return this.aiReviewService.getReviewHistory(questionId);
  }

  // ============================================
  // UPDATE AN EXISTING AI REVIEW (admin override)
  // ============================================
  @Patch('admin/ai-review/:reviewId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({
    summary: 'Update an AI review record (admin override)',
    description:
      'Lets an admin override the verdict, scores, feedback, and critical issues of an existing AI review. Useful for correcting AI misjudgements after a human review.',
  })
  async updateAiReview(
    @Param('reviewId') reviewId: string,
    @Body() dto: Record<string, any>,
  ): Promise<AiReviewResultDto> {
    return this.aiReviewService.updateAiReview(reviewId, dto);
  }
}