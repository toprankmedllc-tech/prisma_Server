import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AiReviewTrigger } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { LLMService } from '../llm/llm.service';
import { ChromaService } from '../chroma/chroma.service';
import { AI_REVIEW_SYSTEM_PROMPT, buildAiReviewUserPrompt } from './prompts/ai-review.prompt';
import { STRINGENT_REVIEW_SYSTEM_PROMPT } from './prompts/stringent-review.prompt';
import { AI_REVIEW_VERIFY_SYSTEM_PROMPT, buildVerifyUserPrompt } from './prompts/ai-review-verify.prompt';
import {
    AiReviewResultDto,
    BatchReviewResultDto,
    AiReviewSummaryDto,
    AiReviewScoreDto,
    AiReviewFeedbackDto,
} from './dto/ai-review.dto';

type ReviewOptions = { autoPublish?: boolean; autoRegenerate?: boolean; stringent?: boolean };

@Injectable()
export class AiReviewService {
    private readonly logger = new Logger(AiReviewService.name);

    constructor(
        @InjectQueue('ai-review')
        private readonly aiReviewQueue: Queue,
        private readonly prisma: PrismaService,
        private readonly llmService: LLMService,
        private readonly chromaService: ChromaService,
    ) {}

    /** Model used for the standard review. */
    private get reviewModel(): string {
        return process.env.OPENROUTER_REVIEW_MODEL || 'deepseek/deepseek-v4-flash';
    }

    // ============================================
    // QUEUE AI REVIEW FOR A QUESTION (used by QuestionGenerationService)
    // ============================================
    async queueAiReviewForQuestion(
        questionId: string,
        options?: { autoPublish?: boolean; autoRegenerate?: boolean },
    ): Promise<void> {
        this.logger.log(`Queueing AI review for question ${questionId}`);

        await this.aiReviewQueue.add(
            'ai-review-single',
            {
                type: 'single',
                questionId,
                options: {
                    // AI review is informational only; publication is controlled by Quality Review.
                    autoPublish: false,
                    autoRegenerate: options?.autoRegenerate ?? false,
                },
            },
            {
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: { age: 86400 },
                removeOnFail: { age: 86400 },
            },
        );
    }

    // ============================================
    // REVIEW A SINGLE QUESTION
    // ============================================
    async reviewQuestion(
        questionId: string,
        options?: { autoPublish?: boolean; autoRegenerate?: boolean; stringent?: boolean },
    ): Promise<AiReviewResultDto> {
        // Publication is intentionally never performed by AI review. The option is
        // retained for API compatibility; publishing belongs to Quality Review.
        const autoRegenerate = options?.autoRegenerate ?? false;
        const stringent = options?.stringent ?? false;

        // 1. Fetch the question with related data
        const question = await this.prisma.question.findUnique({
            where: { id: questionId },
            include: {
                choices: { orderBy: { order: 'asc' } },
                wrongOptions: { orderBy: { order: 'asc' } },
                vitals: true,
                topic: { include: { subject: true } },
                tags: { include: { tag: true } },
            },
        });

        if (!question) {
            throw new Error(`Question ${questionId} not found`);
        }

        // 2. Query ChromaDB for relevant context
        let context = '';
        try {
            const chunks = await this.chromaService.query(
                question.stem.substring(0, 500),
                5,
            );
            context = chunks
                .map((chunk, i) => `[Source ${i + 1}]:\n${chunk.content}`)
                .join('\n\n');
        } catch (error: any) {
            this.logger.warn(`ChromaDB query failed for review context: ${error.message}`);
            context = 'No context available.';
        }

        // 3. Build prompt and call LLM (use the stringent reviewer model when desired)
        const userPrompt = buildAiReviewUserPrompt(question, context, {
            rejected: question.rejected,
            reviewNotes: question.reviewNotes,
            stringent,
        });
        const startTime = Date.now();

        let llmResponse: string;
        try {
            llmResponse = await this.llmService.generateWithPrompt(
                stringent ? STRINGENT_REVIEW_SYSTEM_PROMPT : AI_REVIEW_SYSTEM_PROMPT,
                userPrompt,
                {
                    temperature: 0.2,
                    maxTokens: 4096,
                    jsonMode: true,
                    model: stringent ? this.reviewModel : undefined,
                },
            );
        } catch (error: any) {
            this.logger.error(`LLM review failed for question ${questionId}: ${error.message}`);
            throw new Error(`AI review generation failed: ${error.message}`);
        }

        const reviewDurationMs = Date.now() - startTime;

        // 4. Parse the LLM response
        const reviewResult = this.parseReviewResponse(llmResponse);

        // 4b. Verification pass — an independent second opinion that re-checks
        // the primary verdict to catch false PASS/FAIL (the "rubber-stamp" problem).
        let verification: { verdict: string; agreesWithFirstReviewer: boolean; confidence: number; reason: string } | null = null;
        try {
            const verifyPrompt = buildVerifyUserPrompt(question, {
                verdict: reviewResult.verdict,
                scores: reviewResult.scores as unknown as Record<string, number>,
                feedback: reviewResult.feedback as unknown as Record<string, string | undefined>,
            }, context);
            const verifyResponse = await this.llmService.generateWithPrompt(
                AI_REVIEW_VERIFY_SYSTEM_PROMPT,
                verifyPrompt,
                { temperature: 0.1, maxTokens: 1024, jsonMode: true },
            );
            verification = this.parseVerificationResponse(verifyResponse);
        } catch (error: any) {
            this.logger.warn(`Verification pass failed for question ${questionId}: ${error.message}`);
            verification = null;
        }

        // If the independent verifier disagrees with a PASS, downgrade to FAIL.
        // A disagreement on a FAIL is kept as FAIL (conservative), but recorded.
        let finalVerdict = reviewResult.verdict;
        if (verification && verification.verdict === 'FAIL' && reviewResult.verdict === 'PASS') {
            finalVerdict = 'FAIL';
            this.logger.warn(`Question ${questionId}: verifier downgraded PASS -> FAIL (${verification.reason})`);
        }

        // 5. Save every AI review attempt. Re-reviews must remain auditable and
        // must never overwrite an earlier verdict.
        const previousReviewCount = await this.prisma.aiReview.count({
            where: { questionId },
        });
        const trigger: AiReviewTrigger = question.rejected
            ? AiReviewTrigger.AFTER_HUMAN_REJECTION
            : previousReviewCount > 0
                ? AiReviewTrigger.RE_REVIEW
                : AiReviewTrigger.MANUAL;
        const reviewData = {
            verdict: finalVerdict,
            medicalAccuracyScore: reviewResult.scores.medicalAccuracy,
            hallucinationRiskScore: reviewResult.scores.hallucinationRisk,
            usmleStyleScore: reviewResult.scores.usmleStyle,
            explanationQualityScore: reviewResult.scores.explanationQuality,
            clinicalRelevanceScore: reviewResult.scores.clinicalRelevance,
            grammaticalQualityScore: reviewResult.scores.grammaticalQuality,
            usmleStyleFeedback: reviewResult.feedback.usmleStyle || null,
            medicalAccuracyFeedback: reviewResult.feedback.medicalAccuracy || null,
            hallucinationDetails: reviewResult.feedback.hallucinationDetails || null,
            explanationQualityFeedback: reviewResult.feedback.explanationQuality || null,
            clinicalRelevanceFeedback: reviewResult.feedback.clinicalRelevance || null,
            grammaticalFeedback: reviewResult.feedback.grammatical || null,
            generalFeedback: reviewResult.feedback.general || null,
            reviewedByAi: stringent ? this.reviewModel : 'deepseek/deepseek-v4-flash',
            tokenUsage: undefined,
            reviewDurationMs,
            attemptNumber: previousReviewCount + 1,
            trigger,
            promptVersion: stringent ? 'stringent-v1' : 'v1',
            criticalIssues: reviewResult.criticalIssues || undefined,
            humanRejectionContext: question.rejected ? question.reviewNotes ?? undefined : undefined,
            humanAiAgreement: question.rejected ? reviewResult.verdict === 'FAIL' : undefined,
            verificationVerdict: verification?.verdict,
            verificationAgrees: verification?.agreesWithFirstReviewer,
            verificationConfidence: verification?.confidence,
            verificationReason: verification?.reason,
        };

        const savedReview = await this.prisma.aiReview.create({
            data: { questionId, ...reviewData },
        });

        let replacementQuestionId: string | undefined;

        // 6. AI review never publishes. A PASS only records an opinion; the
        // controlled Quality Review flow is responsible for publication.

        // 7. Flag FAIL for operational visibility, without changing publication state.
        if (reviewResult.verdict === 'FAIL') {
            await this.prisma.question.update({
                where: { id: questionId },
                data: { reviewed: true },
            });
            this.logger.log(`Question ${questionId} flagged as FAIL (AI review).`);
        }

        return {
            id: savedReview.id,
            questionId: savedReview.questionId,
            verdict: savedReview.verdict as 'PASS' | 'FAIL',
            scores: {
                medicalAccuracy: savedReview.medicalAccuracyScore ?? 0,
                hallucinationRisk: savedReview.hallucinationRiskScore ?? 0,
                usmleStyle: savedReview.usmleStyleScore ?? 0,
                explanationQuality: savedReview.explanationQualityScore ?? 0,
                clinicalRelevance: savedReview.clinicalRelevanceScore ?? 0,
                grammaticalQuality: savedReview.grammaticalQualityScore ?? 0,
            },
            feedback: {
                usmleStyle: savedReview.usmleStyleFeedback || undefined,
                medicalAccuracy: savedReview.medicalAccuracyFeedback || undefined,
                hallucinationDetails: savedReview.hallucinationDetails || undefined,
                explanationQuality: savedReview.explanationQualityFeedback || undefined,
                clinicalRelevance: savedReview.clinicalRelevanceFeedback || undefined,
                grammatical: savedReview.grammaticalFeedback || undefined,
                general: savedReview.generalFeedback || undefined,
            },
            reviewedByAi: savedReview.reviewedByAi || undefined,
            tokenUsage: savedReview.tokenUsage || undefined,
            reviewDurationMs: savedReview.reviewDurationMs || undefined,
            replacementQuestionId,
            createdAt: savedReview.createdAt,
        };
    }

    // ============================================
    // BATCH REVIEW
    // ============================================
    async batchReview(
        questionIds: string[],
        options?: { autoPublish?: boolean; autoRegenerate?: boolean; stringent?: boolean },
    ): Promise<BatchReviewResultDto> {
        const results: AiReviewResultDto[] = [];
        let passed = 0;
        let failed = 0;
        let regenerated = 0;

        for (const questionId of questionIds) {
            try {
                const result = await this.reviewQuestion(questionId, options);
                results.push(result);
                if (result.verdict === 'PASS') passed++;
                else failed++;
                if (result.replacementQuestionId) regenerated++;
            } catch (error: any) {
                this.logger.error(`Batch review failed for question ${questionId}: ${error.message}`);
                results.push({
                    id: '',
                    questionId,
                    verdict: 'FAIL',
                    scores: {
                        medicalAccuracy: 0,
                        hallucinationRisk: 100,
                        usmleStyle: 0,
                        explanationQuality: 0,
                        clinicalRelevance: 0,
                        grammaticalQuality: 0,
                    },
                    feedback: { general: `Review failed: ${error.message}` },
                    createdAt: new Date(),
                });
                failed++;
            }
        }

        return {
            total: questionIds.length,
            passed,
            failed,
            regenerated,
            results,
        };
    }

    // ============================================
    // GET UNREVIEWED QUESTIONS
    // ============================================
    async getUnreviewedQuestions(filters?: {
        sourceType?: string;
        difficulty?: string;
        source?: string;
        limit?: number;
    }): Promise<any[]> {
        // Find questions that do NOT have an AiReview record
        const where: any = {
            aiReviews: { none: {} },
        };

        if (filters?.sourceType) where.sourceType = filters.sourceType;
        if (filters?.difficulty) where.difficulty = filters.difficulty;
        if (filters?.source) where.source = filters.source;

        return this.prisma.question.findMany({
            where,
            take: filters?.limit || 50,
            orderBy: { createdAt: 'desc' },
            include: {
                topic: true,
                _count: { select: { choices: true } },
            },
        });
    }

    // ============================================
    // GET REVIEWED QUESTIONS (with AI review data and full question details)
    // ============================================
    async getReviewedQuestions(filters?: {
        sourceType?: string;
        difficulty?: string;
        source?: string;
        verdict?: 'PASS' | 'FAIL';
        limit?: number;
    }): Promise<any[]> {
        const where: any = {
            aiReviews: { some: {} },
        };

        if (filters?.sourceType) where.sourceType = filters.sourceType;
        if (filters?.difficulty) where.difficulty = filters.difficulty;
        if (filters?.source) where.source = filters.source;
        if (filters?.verdict) {
            where.aiReviews = {
                some: { verdict: filters.verdict },
            };
        }

        return this.prisma.question.findMany({
            where,
            take: filters?.limit || 50,
            orderBy: { updatedAt: 'desc' },
            include: {
                topic: { include: { subject: true } },
                choices: { orderBy: { order: 'asc' } },
                wrongOptions: { orderBy: { order: 'asc' } },
                vitals: true,
                tags: { include: { tag: true } },
                aiReviews: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
        });
    }

    // ============================================
    // GET REVIEW SUMMARY
    // ============================================
    async getReviewSummary(): Promise<AiReviewSummaryDto> {
        const [totalReviews, passResults, failResults, avgResults] = await Promise.all([
            this.prisma.aiReview.count(),
            this.prisma.aiReview.count({ where: { verdict: 'PASS' } }),
            this.prisma.aiReview.count({ where: { verdict: 'FAIL' } }),
            this.prisma.aiReview.aggregate({
                _avg: {
                    medicalAccuracyScore: true,
                    hallucinationRiskScore: true,
                    usmleStyleScore: true,
                    explanationQualityScore: true,
                },
            }),
        ]);

        return {
            totalReviews,
            totalPassed: passResults,
            totalFailed: failResults,
            avgMedicalAccuracy: avgResults._avg?.medicalAccuracyScore ?? 0,
            avgHallucinationRisk: avgResults._avg?.hallucinationRiskScore ?? 0,
            avgUsmleStyle: avgResults._avg?.usmleStyleScore ?? 0,
            avgExplanationQuality: avgResults._avg?.explanationQualityScore ?? 0,
        };
    }

    // ============================================
    // GET REVIEW FOR A SPECIFIC QUESTION
    // ============================================
    async getReviewForQuestion(questionId: string): Promise<AiReviewResultDto | null> {
        const review = await this.prisma.aiReview.findFirst({
            where: { questionId },
            orderBy: { createdAt: 'desc' },
        });

        if (!review) return null;

        return this.toResultDto(review);
    }

    // ============================================
    // ============================================
    // UPDATE AN EXISTING AI REVIEW (admin override)
    // ============================================
    async updateAiReview(reviewId: string, dto: Record<string, any>): Promise<AiReviewResultDto> {
        const review = await this.prisma.aiReview.findUnique({ where: { id: reviewId } });
        if (!review) {
            throw new NotFoundException(`AI review with ID "${reviewId}" not found`);
        }

        const data: Record<string, any> = {};

        if (dto.verdict !== undefined) data.verdict = dto.verdict;
        if (dto.scores !== undefined && dto.scores !== null) {
            data.usmleStyleScore = dto.scores.usmleStyle ?? review.usmleStyleScore;
            data.medicalAccuracyScore = dto.scores.medicalAccuracy ?? review.medicalAccuracyScore;
            data.hallucinationRiskScore = dto.scores.hallucinationRisk ?? review.hallucinationRiskScore;
            data.explanationQualityScore = dto.scores.explanationQuality ?? review.explanationQualityScore;
            data.clinicalRelevanceScore = dto.scores.clinicalRelevance ?? review.clinicalRelevanceScore;
            data.grammaticalQualityScore = dto.scores.grammaticalQuality ?? review.grammaticalQualityScore;
        }
        if (dto.feedback !== undefined && dto.feedback !== null) {
            data.usmleStyleFeedback = dto.feedback.usmleStyle ?? review.usmleStyleFeedback;
            data.medicalAccuracyFeedback = dto.feedback.medicalAccuracy ?? review.medicalAccuracyFeedback;
            data.hallucinationDetails = dto.feedback.hallucinationDetails ?? review.hallucinationDetails;
            data.explanationQualityFeedback = dto.feedback.explanationQuality ?? review.explanationQualityFeedback;
            data.clinicalRelevanceFeedback = dto.feedback.clinicalRelevance ?? review.clinicalRelevanceFeedback;
            data.grammaticalFeedback = dto.feedback.grammatical ?? review.grammaticalFeedback;
            data.generalFeedback = dto.feedback.general ?? review.generalFeedback;
        }
        if (dto.criticalIssues !== undefined) data.criticalIssues = dto.criticalIssues;
        if (dto.humanRejectionContext !== undefined) data.humanRejectionContext = dto.humanRejectionContext;
        if (dto.humanAiAgreement !== undefined) data.humanAiAgreement = dto.humanAiAgreement;

        // Human feedback on the AI review itself
        if (dto.humanComment !== undefined) data.humanComment = dto.humanComment;
        if (dto.humanAgree !== undefined) data.humanAgree = dto.humanAgree;
        if (dto.humanReviewedBy !== undefined) data.humanReviewedBy = dto.humanReviewedBy;
        if (dto.humanComment !== undefined || dto.humanAgree !== undefined) {
            data.humanReviewedAt = new Date();
        }

        const updated = await this.prisma.aiReview.update({
            where: { id: reviewId },
            data,
        });

        return this.toResultDto(updated);
    }

    // GET COMPLETE AI REVIEW HISTORY FOR A QUESTION
    // ============================================
    async getReviewHistory(questionId: string): Promise<AiReviewResultDto[]> {
        const reviews = await this.prisma.aiReview.findMany({
            where: { questionId },
            orderBy: [{ attemptNumber: 'desc' }, { createdAt: 'desc' }],
        });
        return reviews.map((review) => this.toResultDto(review));
    }

    private toResultDto(review: any): AiReviewResultDto {
        return {
            id: review.id,
            questionId: review.questionId,
            verdict: review.verdict as 'PASS' | 'FAIL',
            scores: {
                medicalAccuracy: review.medicalAccuracyScore ?? 0,
                hallucinationRisk: review.hallucinationRiskScore ?? 0,
                usmleStyle: review.usmleStyleScore ?? 0,
                explanationQuality: review.explanationQualityScore ?? 0,
                clinicalRelevance: review.clinicalRelevanceScore ?? 0,
                grammaticalQuality: review.grammaticalQualityScore ?? 0,
            },
            feedback: {
                usmleStyle: review.usmleStyleFeedback || undefined,
                medicalAccuracy: review.medicalAccuracyFeedback || undefined,
                hallucinationDetails: review.hallucinationDetails || undefined,
                explanationQuality: review.explanationQualityFeedback || undefined,
                clinicalRelevance: review.clinicalRelevanceFeedback || undefined,
                grammatical: review.grammaticalFeedback || undefined,
                general: review.generalFeedback || undefined,
            },
            reviewedByAi: review.reviewedByAi || undefined,
            tokenUsage: review.tokenUsage || undefined,
            reviewDurationMs: review.reviewDurationMs || undefined,
            replacementQuestionId: review.replacementQuestionId || undefined,
            attemptNumber: review.attemptNumber,
            trigger: review.trigger,
            promptVersion: review.promptVersion,
            humanRejectionContext: review.humanRejectionContext ?? undefined,
            criticalIssues: review.criticalIssues ?? undefined,
            humanAiAgreement: review.humanAiAgreement ?? undefined,
            humanComment: review.humanComment ?? undefined,
            humanAgree: review.humanAgree ?? undefined,
            humanReviewedBy: review.humanReviewedBy ?? undefined,
            humanReviewedAt: review.humanReviewedAt ?? undefined,
            verificationVerdict: review.verificationVerdict ?? undefined,
            verificationAgrees: review.verificationAgrees ?? undefined,
            verificationConfidence: review.verificationConfidence ?? undefined,
            verificationReason: review.verificationReason ?? undefined,
            createdAt: review.createdAt,
        };
    }

    // ============================================
    // PARSE LLM REVIEW RESPONSE
    // ============================================
    private parseReviewResponse(content: string): {
        verdict: 'PASS' | 'FAIL';
        scores: AiReviewScoreDto;
        feedback: AiReviewFeedbackDto;
        criticalIssues?: unknown;
    } {
        let cleanedContent = content.trim();

        if (cleanedContent.startsWith('```json')) {
            cleanedContent = cleanedContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (cleanedContent.startsWith('```')) {
            cleanedContent = cleanedContent.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }

        let parsed: any;
        try {
            parsed = JSON.parse(cleanedContent);
        } catch (error: any) {
            const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    parsed = JSON.parse(jsonMatch[0]);
                } catch {
                    throw new Error(`Failed to parse review response as JSON: ${error.message}`);
                }
            } else {
                throw new Error(`Invalid JSON response from review LLM: ${error.message}`);
            }
        }

        const scores: AiReviewScoreDto = {
            medicalAccuracy: parsed.scores?.medicalAccuracy ?? 50,
            hallucinationRisk: parsed.scores?.hallucinationRisk ?? 50,
            usmleStyle: parsed.scores?.usmleStyle ?? 50,
            explanationQuality: parsed.scores?.explanationQuality ?? 50,
            clinicalRelevance: parsed.scores?.clinicalRelevance ?? 50,
            grammaticalQuality: parsed.scores?.grammaticalQuality ?? 50,
        };

        const feedback: AiReviewFeedbackDto = {
            usmleStyle: parsed.feedback?.usmleStyle,
            medicalAccuracy: parsed.feedback?.medicalAccuracy,
            hallucinationDetails: parsed.feedback?.hallucinationDetails,
            explanationQuality: parsed.feedback?.explanationQuality,
            clinicalRelevance: parsed.feedback?.clinicalRelevance,
            grammatical: parsed.feedback?.grammatical,
            general: parsed.feedback?.general,
        };

        const verdict: 'PASS' | 'FAIL' =
            parsed.verdict === 'PASS' ? 'PASS' : 'FAIL';

        return { verdict, scores, feedback, criticalIssues: parsed.criticalIssues };
    }

    // ============================================
    // PARSE VERIFICATION RESPONSE (second opinion)
    // ============================================
    private parseVerificationResponse(content: string): {
        verdict: string;
        agreesWithFirstReviewer: boolean;
        confidence: number;
        reason: string;
    } {
        let cleanedContent = content.trim();
        if (cleanedContent.startsWith('```json')) {
            cleanedContent = cleanedContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (cleanedContent.startsWith('```')) {
            cleanedContent = cleanedContent.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }

        let parsed: any;
        try {
            parsed = JSON.parse(cleanedContent);
        } catch (error: any) {
            const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    parsed = JSON.parse(jsonMatch[0]);
                } catch {
                    throw new Error(`Failed to parse verification response as JSON: ${error.message}`);
                }
            } else {
                throw new Error(`Invalid JSON response from verification LLM: ${error.message}`);
            }
        }

        return {
            verdict: parsed.verdict === 'PASS' ? 'PASS' : 'FAIL',
            agreesWithFirstReviewer: parsed.agreesWithFirstReviewer === true,
            confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)),
            reason: parsed.reason || '',
        };
    }
}