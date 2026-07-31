import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
// USER DETAILS
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

    @ApiProperty({ description: 'Number of questions reviewed by this user' })
    reviewedCount!: number;

    @ApiProperty({ description: 'Number of questions skipped by this user' })
    skippedCount!: number;

    @ApiProperty({ description: 'Number of questions currently assigned to this user' })
    assignedCount!: number;

    @ApiProperty({ description: 'Number of approved questions by this user' })
    approvedCount!: number;

    @ApiProperty({ description: 'Number of rejected questions by this user' })
    rejectedCount!: number;

    @ApiProperty({ description: 'Whether the user is active' })
    isActive!: boolean;

    @ApiProperty({ description: 'When the user joined' })
    createdAt!: Date;
}

export class UserReviewStatsListDto {
    @ApiProperty({ type: [UserReviewStatsDto], description: 'List of users with their review stats' })
    users!: UserReviewStatsDto[];

    @ApiProperty({ description: 'Total number of users' })
    total!: number;
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
// UPDATE USER ROLE
// ============================================
export class UpdateUserRoleDto {
    @ApiProperty({ description: 'New role for the user', enum: ['STUDENT', 'REVIEWER', 'ADMIN'] })
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