import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
    DashboardSummaryDto,
    UserOverviewStatsDto,
    QuestionOverviewStatsDto,
    UserReviewStatsDto,
    UserReviewStatsListDto,
    ReviewActivityResponseDto,
    ReviewActivityDto,
    QuestionBreakdownDto,
    UpdateUserRoleDto,
    UpdateUserRoleResponseDto,
} from './dto/admin.dto';

@Injectable()
export class AdminService {
    private readonly logger = new Logger(AdminService.name);

    constructor(private prisma: PrismaService) {}

    // ============================================
    // DASHBOARD SUMMARY
    // ============================================
    async getDashboardSummary(): Promise<DashboardSummaryDto> {
        const [users, questions] = await Promise.all([
            this.getUserOverview(),
            this.getQuestionOverview(),
        ]);

        return { users, questions };
    }

    // ============================================
    // USER OVERVIEW STATS
    // ============================================
    async getUserOverview(): Promise<UserOverviewStatsDto> {
        const [totalUsers, totalAdmins, activeUsers] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.user.count({ where: { role: 'ADMIN' } }),
            this.prisma.user.count({ where: { isActive: true } }),
        ]);

        // Count users who have reviewed at least one question
        const allUsers = await this.prisma.user.findMany({
            select: { reviewedQuestions: true },
        });
        const totalReviewers = allUsers.filter(
            (u) => u.reviewedQuestions.length > 0,
        ).length;

        return {
            totalUsers,
            totalAdmins,
            totalReviewers,
            activeUsers,
        };
    }

    // ============================================
    // QUESTION OVERVIEW STATS
    // ============================================
    async getQuestionOverview(): Promise<QuestionOverviewStatsDto> {
        const [totalQuestions, published, unpublished, reviewed, rejected] =
            await Promise.all([
                this.prisma.question.count(),
                this.prisma.question.count({ where: { isPublished: true } }),
                this.prisma.question.count({ where: { isPublished: false } }),
                this.prisma.question.count({ where: { reviewed: true } }),
                this.prisma.question.count({ where: { rejected: true } }),
            ]);

        // Count total skipped questions across all users
        const allUsers = await this.prisma.user.findMany({
            select: { skippedQuestions: true },
        });
        const totalSkipped = allUsers.reduce(
            (sum, u) => sum + u.skippedQuestions.length,
            0,
        );

        return {
            totalQuestions,
            published,
            unpublished,
            totalReviewed: reviewed,
            approved: reviewed - rejected,
            rejected,
            totalSkipped,
        };
    }

    // ============================================
    // USER REVIEW STATS (detailed per-user)
    // ============================================
    async getUserReviewStats(): Promise<UserReviewStatsListDto> {
        const users = await this.prisma.user.findMany({
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true,
                createdAt: true,
                reviewedQuestions: true,
                skippedQuestions: true,
                assignedQuestions: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        // Get rejection counts for each user's reviewed questions
        const userReviewStats = await Promise.all(
            users.map(async (user) => {
                let approvedCount = 0;
                let rejectedCount = 0;

                if (user.reviewedQuestions.length > 0) {
                    const questions = await this.prisma.question.findMany({
                        where: { id: { in: user.reviewedQuestions } },
                        select: { rejected: true },
                    });
                    rejectedCount = questions.filter((q) => q.rejected).length;
                    approvedCount = questions.length - rejectedCount;
                }

                const stats: UserReviewStatsDto = {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                    reviewedCount: user.reviewedQuestions.length,
                    skippedCount: user.skippedQuestions.length,
                    assignedCount: user.assignedQuestions.length,
                    approvedCount,
                    rejectedCount,
                    isActive: user.isActive,
                    createdAt: user.createdAt,
                };
                return stats;
            }),
        );

        return {
            users: userReviewStats,
            total: userReviewStats.length,
        };
    }

    // ============================================
    // REVIEW ACTIVITY OVER TIME
    // ============================================
    async getReviewActivity(
        days: number = 30,
    ): Promise<ReviewActivityResponseDto> {
        const since = new Date();
        since.setDate(since.getDate() - days);

        // Get all questions that were reviewed in the period
        const reviewedQuestions = await this.prisma.question.findMany({
            where: {
                updatedAt: { gte: since },
                reviewed: true,
            },
            select: { updatedAt: true },
            orderBy: { updatedAt: 'asc' },
        });

        // Group by date
        const activityMap = new Map<string, number>();
        for (const q of reviewedQuestions) {
            const dateKey = q.updatedAt.toISOString().split('T')[0];
            activityMap.set(dateKey, (activityMap.get(dateKey) || 0) + 1);
        }

        // Fill in all dates in the range
        const activity: ReviewActivityDto[] = [];
        const current = new Date(since);
        const today = new Date();
        while (current <= today) {
            const dateKey = current.toISOString().split('T')[0];
            activity.push({
                date: dateKey,
                count: activityMap.get(dateKey) || 0,
            });
            current.setDate(current.getDate() + 1);
        }

        return {
            activity,
            total: reviewedQuestions.length,
        };
    }

    // ============================================
    // QUESTION BREAKDOWN (detailed stats)
    // ============================================
    async getQuestionBreakdown(): Promise<QuestionBreakdownDto> {
        const total = await this.prisma.question.count();

        const byDifficulty = await this.prisma.$transaction([
            this.prisma.question.count({ where: { difficulty: 'EASY' } }),
            this.prisma.question.count({ where: { difficulty: 'MEDIUM' } }),
            this.prisma.question.count({ where: { difficulty: 'HARD' } }),
        ]);

        const bySourceType = await this.prisma.$transaction([
            this.prisma.question.count({ where: { sourceType: 'BUZZWORD' } }),
            this.prisma.question.count({ where: { sourceType: 'VIGNETTE' } }),
        ]);

        const bySource = await this.prisma.$transaction([
            this.prisma.question.count({
                where: { source: 'HUMAN_GENERATED' },
            }),
            this.prisma.question.count({ where: { source: 'AI_GENERATED' } }),
            this.prisma.question.count({ where: { source: 'MANUAL' } }),
            this.prisma.question.count({ where: { source: 'IMPORTED' } }),
        ]);

        const [published, unpublished] = await Promise.all([
            this.prisma.question.count({ where: { isPublished: true } }),
            this.prisma.question.count({ where: { isPublished: false } }),
        ]);

        // Get system breakdown
        const systemGroups = await this.prisma.question.groupBy({
            by: ['system'],
            where: { system: { not: null } },
            _count: true,
        });
        const bySystem: Record<string, number> = {};
        systemGroups.forEach((group) => {
            if (group.system) bySystem[group.system] = group._count;
        });

        // Get subject and topic breakdown
        const topicCounts = await this.prisma.question.groupBy({
            by: ['topicId'],
            _count: true,
        });
        const allTopics = await this.prisma.topic.findMany({
            include: { subject: true },
        });
        const topicCountMap = new Map<string, number>();
        topicCounts.forEach((g) => topicCountMap.set(g.topicId, g._count));

        const bySubject: Record<string, number> = {};
        const byTopic: Record<string, number> = {};

        for (const topic of allTopics) {
            const count = topicCountMap.get(topic.id) || 0;
            const subjectName = topic.subject.name;
            bySubject[subjectName] = (bySubject[subjectName] || 0) + count;
            byTopic[topic.name] = count;
        }

        return {
            total,
            byDifficulty: {
                EASY: byDifficulty[0],
                MEDIUM: byDifficulty[1],
                HARD: byDifficulty[2],
            },
            bySourceType: {
                BUZZWORD: bySourceType[0],
                VIGNETTE: bySourceType[1],
            },
            bySource: {
                HUMAN_GENERATED: bySource[0],
                AI_GENERATED: bySource[1],
                MANUAL: bySource[2],
                IMPORTED: bySource[3],
            },
            bySubject,
            byTopic,
            bySystem,
            published,
            unpublished,
        };
    }


        // ============================================
    // UPDATE USER ROLE
    // ============================================
    async updateUserRole(
        userId: string,
        dto: UpdateUserRoleDto,
    ): Promise<UpdateUserRoleResponseDto> {
        const validRoles = ["STUDENT", "REVIEWER", "ADMIN"];
        if (!validRoles.includes(dto.role)) {
            throw new BadRequestException(`Invalid role: ${dto.role}. Must be one of ${validRoles.join(", ")}`);
        }

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true },
        });

        if (!user) {
            throw new NotFoundException("User not found");
        }

        await this.prisma.user.update({
            where: { id: userId },
            data: { role: dto.role },
        });

        this.logger.log(`User ${userId} role changed from ${user.role} to ${dto.role}`);

        return {
            message: `User role updated to ${dto.role}`,
            userId,
            newRole: dto.role,
        };
    }
}