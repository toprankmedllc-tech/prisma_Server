import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsIn } from 'class-validator';

// ============================================
// OVERVIEW STATS
// ============================================
export class UserOverviewStatsDto {
    @ApiProperty({ description: 'Total number of registered users' })
    totalUsers!: number;

    @ApiProperty({ description: 'Number of admin users' })
    totalAdmins!: number;

    @ApiProperty({ description: 'Number of users who have reviewed at least one question' })
    totalReviewers!: number;

    @ApiProperty({ description: 'Number of active users' })
    activeUsers!: number;
}

export class QuestionOverviewStatsDto {
    @ApiProperty({ description: 'Total number of questions' })
    totalQuestions!: number;

    @ApiProperty({ description: 'Number of published questions' })
    published!: number;

    @ApiProperty({ description: 'Number of unpublished questions' })
    unpublished!: number;

    @ApiProperty({ description: 'Total number of reviewed questions (approved or rejected)' })
    totalReviewed!: number;

    @ApiProperty({ description: 'Number of approved questions (reviewed & not rejected)' })
    approved!: number;

    @ApiProperty({ description: 'Number of rejected questions (reviewed & rejected)' })
    rejected!: number;

    @ApiProperty({ description: 'Total number of skipped questions across all users' })
    totalSkipped!: number;
}

export class DashboardSummaryDto {
    @ApiProperty({ description: 'User statistics overview' })
    users!: UserOverviewStatsDto;

    @ApiProperty({ description: 'Question statistics overview' })
    questions!: QuestionOverviewStatsDto;
}

// ============================================
// REVIEW ACTIVITY
// ============================================
export class ReviewActivityDto {
    @ApiProperty({ description: 'Date of review activity (YYYY-MM-DD)' })
    date!: string;

    @ApiProperty({ description: 'Number of reviews on this date' })
    count!: number;
}

export class ReviewActivityResponseDto {
    @ApiProperty({ type: [ReviewActivityDto], description: 'Review activity by date' })
    activity!: ReviewActivityDto[];

    @ApiProperty({ description: 'Total reviews in the period' })
    total!: number;
}

// ============================================
// QUESTION BREAKDOWN
// ============================================
export class QuestionBreakdownDto {
    @ApiProperty({ description: 'Total questions' })
    total!: number;

    @ApiProperty({ description: 'Breakdown by difficulty' })
    byDifficulty!: Record<string, number>;

    @ApiProperty({ description: 'Breakdown by source type (BUZZWORD / VIGNETTE)' })
    bySourceType!: Record<string, number>;

    @ApiProperty({ description: 'Breakdown by source (AI_GENERATED / HUMAN_GENERATED etc.)' })
    bySource!: Record<string, number>;

    @ApiProperty({ description: 'Breakdown by subject' })
    bySubject!: Record<string, number>;

    @ApiProperty({ description: 'Breakdown by topic' })
    byTopic!: Record<string, number>;

    @ApiProperty({ description: 'Breakdown by system' })
    bySystem!: Record<string, number>;

    @ApiProperty({ description: 'Published vs unpublished' })
    published!: number;

    @ApiProperty({ description: 'Unpublished count' })
    unpublished!: number;
}

// ============================================
// QUESTION GENERATION (reusing existing DTOs)
// ============================================
export class SubjectOptionDto {
    @ApiProperty({ description: 'Subject ID' })
    id!: string;

    @ApiProperty({ description: 'Subject name' })
    name!: string;

    @ApiProperty({ description: 'Subject description' })
    description!: string | null;
}

export class TopicOptionDto {
    @ApiProperty({ description: 'Topic ID' })
    topicId!: string;

    @ApiProperty({ description: 'Topic name' })
    topic!: string;

    @ApiProperty({ description: 'Question count for this topic' })
    questionCount!: number;
}

// ============================================
// USER REVIEW STATS (per-user table)
// ============================================
export class UserReviewStatsDto {
    @ApiProperty({ description: 'User ID' })
    id!: string;

    @ApiProperty({ description: 'User email' })
    email!: string;

    @ApiProperty({ description: 'User first name' })
    firstName!: string | null;

    @ApiProperty({ description: 'User last name' })
    lastName!: string | null;

    @ApiProperty({ description: 'User role' })
    role!: string;

    @ApiProperty({ description: 'Number of reviewed questions' })
    reviewedCount!: number;

    @ApiProperty({ description: 'Number of skipped questions' })
    skippedCount!: number;

    @ApiProperty({ description: 'Number of assigned questions' })
    assignedCount!: number;

    @ApiProperty({ description: 'Number of approved questions' })
    approvedCount!: number;

    @ApiProperty({ description: 'Number of rejected questions' })
    rejectedCount!: number;

    @ApiProperty({ description: 'Whether the user is active' })
    isActive!: boolean;

    @ApiProperty({ description: 'When the user joined' })
    createdAt!: Date;
}

export class UserReviewStatsListDto {
    @ApiProperty({ type: [UserReviewStatsDto], description: 'List of users with review stats' })
    users!: UserReviewStatsDto[];

    @ApiProperty({ description: 'Total number of users' })
    total!: number;
}

// ============================================
// UPDATE USER ROLE
// ============================================
export class UpdateUserRoleDto {
    @ApiProperty({ description: 'New role for the user', enum: ['STUDENT', 'REVIEWER', 'ADMIN'] })
    @IsString()
    @IsIn(['STUDENT', 'REVIEWER', 'ADMIN'])
    role!: 'STUDENT' | 'REVIEWER' | 'ADMIN';
}

export class UpdateUserRoleResponseDto {
    @ApiProperty({ description: 'Success message' })
    message!: string;

    @ApiProperty({ description: 'User ID' })
    userId!: string;

    @ApiProperty({ description: 'New role assigned' })
    newRole!: string;
}

// ============================================
// USER DETAIL (with reviewed questions)
// ============================================
export class UserDetailDto {
    @ApiProperty({ description: 'User ID' })
    id!: string;

    @ApiProperty({ description: 'User email' })
    email!: string;

    @ApiProperty({ description: 'User first name' })
    firstName!: string | null;

    @ApiProperty({ description: 'User last name' })
    lastName!: string | null;

    @ApiProperty({ description: 'User role' })
    role!: string;

    @ApiProperty({ description: 'Student type' })
    studentType!: string | null;

    @ApiProperty({ description: 'Target exam' })
    targetExam!: string | null;

    @ApiProperty({ description: 'Target test date' })
    targetTestDate!: Date | null;

    @ApiProperty({ description: 'Whether the user is active' })
    isActive!: boolean;

    @ApiProperty({ description: 'When the user joined' })
    createdAt!: Date;

    @ApiProperty({ description: 'When the user was last updated' })
    updatedAt!: Date;

    @ApiProperty({ description: 'Number of reviewed questions' })
    reviewedCount!: number;

    @ApiProperty({ description: 'Number of skipped questions' })
    skippedCount!: number;

    @ApiProperty({ description: 'Number of assigned questions' })
    assignedCount!: number;
}

export class UserReviewedQuestionDetailDto {
    @ApiProperty({ description: 'Question ID' })
    id!: string;

    @ApiProperty({ description: 'Question stem' })
    stem!: string;

    @ApiProperty({ description: 'Question difficulty' })
    difficulty!: string;

    @ApiProperty({ description: 'Question source type' })
    sourceType!: string | null;

    @ApiProperty({ description: 'Topic name' })
    topic!: string;

    @ApiProperty({ description: 'Subject name' })
    subject!: string;

    @ApiProperty({ description: 'Whether the question is reviewed' })
    reviewed!: boolean;

    @ApiProperty({ description: 'Whether the question is rejected' })
    rejected!: boolean;

    @ApiProperty({ description: 'Whether the question is published' })
    isPublished!: boolean;

    @ApiProperty({ description: 'Review notes' })
    reviewNotes!: Record<string, any> | null;

    @ApiProperty({ description: 'Reviewed by user ID' })
    reviewedBy!: string | null;

    @ApiProperty({ description: 'When the question was created' })
    createdAt!: Date;

    @ApiProperty({ description: 'When the question was last updated' })
    updatedAt!: Date;

    @ApiProperty({ description: 'Quality review medical accuracy' })
    qualityMedicalAccuracy!: string | null;

    @ApiProperty({ description: 'Quality review USMLE style' })
    qualityUsmleStyle!: string | null;

    @ApiProperty({ description: 'Quality review explanation quality' })
    qualityExplanationQuality!: string | null;

    @ApiProperty({ description: 'Quality review originality' })
    qualityOriginality!: string | null;

    @ApiProperty({ description: 'Quality review grammar' })
    qualityGrammar!: string | null;

    @ApiProperty({ description: 'Quality review vignette review' })
    qualityVignetteReview!: string | null;

    @ApiProperty({ description: 'Quality review buzzword review' })
    qualityBuzzwordReview!: string | null;
}

export class UserDetailResponseDto {
    @ApiProperty({ description: 'User details' })
    user!: UserDetailDto;

    @ApiProperty({ type: [UserReviewedQuestionDetailDto], description: 'List of reviewed questions with review details' })
    reviewedQuestions!: UserReviewedQuestionDetailDto[];
}
