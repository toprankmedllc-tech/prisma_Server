import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
    UserAnalyticsDto,
    UserAnalyticsOverviewDto,
    ActivityHeatmapDto,
    ActivityHeatmapDayDto,
    StreakInfoDto,
    TopicPerformanceDto,
    SubjectPerformanceDto,
    WeeklyPerformanceDto,
    StudySessionAnalyticsDto,
    MockExamAnalyticsDto,
    EngagementDto,
} from './dto/user-analytics.dto';

interface FlatAttempt {
    questionId: string;
    isCorrect: boolean;
    timeSpentSec: number;
    attemptedAt: Date;
}

@Injectable()
export class UserAnalyticsService {
    private readonly logger = new Logger(UserAnalyticsService.name);

    constructor(private prisma: PrismaService) {}

    // ============================================
    // MAIN ENTRY POINT
    // ============================================
    async getUserAnalytics(userId: string, days: number = 90): Promise<UserAnalyticsDto> {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException(`User with ID "${userId}" not found`);
        }

        // Gather raw data in parallel
        const [studyAttempts, examAttempts, flags, highlights, studySessions] =
            await Promise.all([
                this.getStudyAttempts(userId),
                this.getExamAttempts(userId),
                this.prisma.questionFlag.findMany({
                    where: { userId },
                    select: { context: true, createdAt: true },
                }),
                this.prisma.questionHighlight.findMany({
                    where: { userId },
                    select: { color: true, createdAt: true },
                }),
                this.prisma.studySession.findMany({
                    where: { userId },
                    orderBy: { startedAt: 'desc' },
                    include: {
                        questions: {
                            include: { answerAttempts: true },
                        },
                    },
                }),
            ]);

        // Flatten all attempts into a single timeline
        const allAttempts: FlatAttempt[] = [...studyAttempts, ...this.flattenExamAttempts(examAttempts)];

        const overview = this.buildOverview(allAttempts, studySessions, examAttempts, flags, highlights);
        const heatmap = this.buildHeatmap(allAttempts, days);
        const streaks = this.buildStreaks(allAttempts);
        const byTopic = await this.buildByTopic(allAttempts);
        const bySubject = await this.buildBySubject(allAttempts);
        const weekly = this.buildWeekly(allAttempts, days);
        const studySessionList = this.buildStudySessions(studySessions);
        const mockExamList = this.buildMockExams(examAttempts);
        const engagement = this.buildEngagement(flags, highlights);

        return {
            userId,
            overview,
            heatmap,
            streaks,
            byTopic,
            bySubject,
            weekly,
            studySessions: studySessionList,
            mockExams: mockExamList,
            engagement,
        };
    }

    // ============================================
    // DATA GATHERING
    // ============================================
    private async getStudyAttempts(userId: string): Promise<FlatAttempt[]> {
        // StudyAnswerAttempt -> StudySessionQuestion -> StudySession (userId)
        const sessions = await this.prisma.studySession.findMany({
            where: { userId },
            select: {
                questions: {
                    select: {
                        questionId: true,
                        answerAttempts: {
                            select: { isCorrect: true, timeSpentSec: true, attemptedAt: true },
                        },
                    },
                },
            },
        });

        const attempts: FlatAttempt[] = [];
        for (const session of sessions) {
            for (const sq of session.questions) {
                for (const a of sq.answerAttempts) {
                    attempts.push({
                        questionId: sq.questionId,
                        isCorrect: a.isCorrect,
                        timeSpentSec: a.timeSpentSec,
                        attemptedAt: a.attemptedAt,
                    });
                }
            }
        }
        return attempts;
    }

    private async getExamAttempts(userId: string): Promise<Array<{
        id: string;
        status: string;
        score: number;
        correctAnswers: number;
        answeredQuestions: number;
        startedAt: Date;
        completedAt: Date | null;
        questionAttempts: unknown;
        exam: { title: string; questions: Array<unknown> };
    }>> {
        return this.prisma.examAttempt.findMany({
            where: { userId },
            orderBy: { startedAt: 'desc' },
            include: {
                exam: {
                    include: { questions: true },
                },
            },
        });
    }

    private flattenExamAttempts(
        attempts: Array<{ questionAttempts: unknown }>,
    ): FlatAttempt[] {
        const flat: FlatAttempt[] = [];
        for (const attempt of attempts) {
            const records = attempt.questionAttempts as Array<Record<string, any>>;
            if (!Array.isArray(records)) continue;
            for (const record of records) {
                // Skip TIP records (no answer)
                if (record.type === 'TIP' || !record.questionId) continue;
                flat.push({
                    questionId: record.questionId,
                    isCorrect: Boolean(record.isCorrect),
                    timeSpentSec: Number(record.timeSpentSec || 0),
                    attemptedAt: record.answeredAt ? new Date(record.answeredAt) : new Date(),
                });
            }
        }
        return flat;
    }

    // ============================================
    // OVERVIEW
    // ============================================
    private buildOverview(
        attempts: FlatAttempt[],
        studySessions: Array<{ status: string }>,
        examAttempts: Array<{ status: string; score: number }>,
        flags: Array<{ context: string }>,
        highlights: Array<{ color: string }>,
    ): UserAnalyticsOverviewDto {
        const total = attempts.length;
        const correct = attempts.filter((a) => a.isCorrect).length;
        const incorrect = total - correct;
        const accuracy = total ? Math.round((correct / total) * 100) : 0;
        const totalTimeSpentSec = attempts.reduce((sum, a) => sum + a.timeSpentSec, 0);

        const completedSessions = studySessions.filter((s) => s.status === 'COMPLETED').length;
        const completedExams = examAttempts.filter((e) => e.status === 'COMPLETED').length;
        const completedExamScores = examAttempts
            .filter((e) => e.status === 'COMPLETED')
            .map((e) => e.score);
        const avgMockScore = completedExamScores.length
            ? Math.round(completedExamScores.reduce((a, b) => a + b, 0) / completedExamScores.length)
            : 0;

        const streaks = this.buildStreaks(attempts);

        return {
            totalQuestionsAttempted: total,
            totalCorrect: correct,
            totalIncorrect: incorrect,
            accuracy,
            totalStudySessions: studySessions.length,
            completedStudySessions: completedSessions,
            totalMockExams: examAttempts.length,
            completedMockExams: completedExams,
            avgMockScore,
            totalTimeSpentSec,
            currentStreak: streaks.current,
            longestStreak: streaks.longest,
            totalFlags: flags.length,
            totalHighlights: highlights.length,
            daysSinceLastActivity: streaks.lastActiveDate
                ? this.daysBetween(new Date(streaks.lastActiveDate), new Date())
                : 0,
        };
    }

    // ============================================
    // HEATMAP (dense daily series)
    // ============================================
    private buildHeatmap(attempts: FlatAttempt[], days: number): ActivityHeatmapDto {
        const since = new Date();
        since.setDate(since.getDate() - (days - 1));
        since.setHours(0, 0, 0, 0);

        const map = new Map<string, { count: number; correct: number; timeSpentSec: number }>();
        for (const a of attempts) {
            if (a.attemptedAt < since) continue;
            const key = a.attemptedAt.toISOString().split('T')[0];
            const entry = map.get(key) || { count: 0, correct: 0, timeSpentSec: 0 };
            entry.count += 1;
            if (a.isCorrect) entry.correct += 1;
            entry.timeSpentSec += a.timeSpentSec;
            map.set(key, entry);
        }

        const daysArr: ActivityHeatmapDayDto[] = [];
        const current = new Date(since);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        while (current <= today) {
            const key = current.toISOString().split('T')[0];
            const entry = map.get(key);
            daysArr.push({
                date: key,
                count: entry?.count || 0,
                correct: entry?.correct || 0,
                timeSpentSec: entry?.timeSpentSec || 0,
            });
            current.setDate(current.getDate() + 1);
        }

        const activeDays = daysArr.filter((d) => d.count > 0).length;
        const total = daysArr.reduce((sum, d) => sum + d.count, 0);

        return { days: daysArr, total, activeDays };
    }

    // ============================================
    // STREAKS
    // ============================================
    private buildStreaks(attempts: FlatAttempt[]): StreakInfoDto {
        const activeDates = new Set<string>();
        for (const a of attempts) {
            activeDates.add(a.attemptedAt.toISOString().split('T')[0]);
        }

        if (activeDates.size === 0) {
            return { current: 0, longest: 0, lastActiveDate: null, isActiveToday: false };
        }

        const sorted = [...activeDates].sort();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayKey = today.toISOString().split('T')[0];
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayKey = yesterday.toISOString().split('T')[0];

        // Longest streak
        let longest = 1;
        let run = 1;
        for (let i = 1; i < sorted.length; i++) {
            const prev = new Date(sorted[i - 1]);
            const curr = new Date(sorted[i]);
            const diff = this.daysBetween(prev, curr);
            if (diff === 1) {
                run += 1;
                longest = Math.max(longest, run);
            } else {
                run = 1;
            }
        }

        // Current streak: walk backwards from today (or yesterday if today inactive)
        let current = 0;
        const isActiveToday = activeDates.has(todayKey);
        let cursor = new Date(today);
        if (!isActiveToday) {
            cursor = new Date(yesterday);
        }
        while (activeDates.has(cursor.toISOString().split('T')[0])) {
            current += 1;
            cursor.setDate(cursor.getDate() - 1);
        }

        return {
            current,
            longest,
            lastActiveDate: sorted[sorted.length - 1],
            isActiveToday,
        };
    }

    // ============================================
    // PERFORMANCE BY TOPIC / SUBJECT
    // ============================================
    private async buildByTopic(attempts: FlatAttempt[]): Promise<TopicPerformanceDto[]> {
        if (attempts.length === 0) return [];

        const questionIds = [...new Set(attempts.map((a) => a.questionId))];
        const questions = await this.prisma.question.findMany({
            where: { id: { in: questionIds } },
            select: {
                id: true,
                topic: { select: { id: true, name: true, subject: { select: { name: true } } } },
            },
        });
        const qMap = new Map(questions.map((q) => [q.id, q]));

        const topicMap = new Map<string, { topicId: string; topic: string; subject: string; attempted: number; correct: number }>();
        for (const a of attempts) {
            const q = qMap.get(a.questionId);
            if (!q) continue;
            const key = q.topic.id;
            const entry = topicMap.get(key) || {
                topicId: q.topic.id,
                topic: q.topic.name,
                subject: q.topic.subject.name,
                attempted: 0,
                correct: 0,
            };
            entry.attempted += 1;
            if (a.isCorrect) entry.correct += 1;
            topicMap.set(key, entry);
        }

        return [...topicMap.values()]
            .map((e) => ({
                ...e,
                accuracy: e.attempted ? Math.round((e.correct / e.attempted) * 100) : 0,
            }))
            .sort((a, b) => b.attempted - a.attempted);
    }

    private async buildBySubject(attempts: FlatAttempt[]): Promise<SubjectPerformanceDto[]> {
        if (attempts.length === 0) return [];

        const questionIds = [...new Set(attempts.map((a) => a.questionId))];
        const questions = await this.prisma.question.findMany({
            where: { id: { in: questionIds } },
            select: {
                id: true,
                topic: { select: { subject: { select: { name: true } } } },
            },
        });
        const qMap = new Map(questions.map((q) => [q.id, q]));

        const subjectMap = new Map<string, { subject: string; attempted: number; correct: number }>();
        for (const a of attempts) {
            const q = qMap.get(a.questionId);
            if (!q) continue;
            const name = q.topic.subject.name;
            const entry = subjectMap.get(name) || { subject: name, attempted: 0, correct: 0 };
            entry.attempted += 1;
            if (a.isCorrect) entry.correct += 1;
            subjectMap.set(name, entry);
        }

        return [...subjectMap.values()]
            .map((e) => ({
                ...e,
                accuracy: e.attempted ? Math.round((e.correct / e.attempted) * 100) : 0,
            }))
            .sort((a, b) => b.attempted - a.attempted);
    }

    // ============================================
    // WEEKLY PERFORMANCE
    // ============================================
    private buildWeekly(attempts: FlatAttempt[], days: number): WeeklyPerformanceDto[] {
        const since = new Date();
        since.setDate(since.getDate() - (days - 1));
        since.setHours(0, 0, 0, 0);

        const weekMap = new Map<string, { attempted: number; correct: number }>();
        for (const a of attempts) {
            if (a.attemptedAt < since) continue;
            const weekStart = this.startOfWeek(a.attemptedAt);
            const key = weekStart.toISOString().split('T')[0];
            const entry = weekMap.get(key) || { attempted: 0, correct: 0 };
            entry.attempted += 1;
            if (a.isCorrect) entry.correct += 1;
            weekMap.set(key, entry);
        }

        return [...weekMap.entries()]
            .map(([week, e]) => ({
                week,
                attempted: e.attempted,
                correct: e.correct,
                accuracy: e.attempted ? Math.round((e.correct / e.attempted) * 100) : 0,
            }))
            .sort((a, b) => a.week.localeCompare(b.week));
    }

    // ============================================
    // STUDY SESSIONS
    // ============================================
    private buildStudySessions(
        sessions: Array<{
            id: string;
            title: string;
            status: string;
            startedAt: Date;
            completedAt: Date | null;
            questions: Array<{
                status: string;
                totalTimeSpentSec: number;
                pointsAwarded: number;
                answerAttempts: Array<{ isCorrect: boolean }>;
            }>;
        }>,
    ): StudySessionAnalyticsDto[] {
        return sessions.map((s) => {
            const answered = s.questions.filter((q) => q.status !== 'UNANSWERED').length;
            const correct = s.questions.filter((q) => q.status === 'CORRECT').length;
            const totalTime = s.questions.reduce((sum, q) => sum + q.totalTimeSpentSec, 0);
            const points = s.questions.reduce((sum, q) => sum + q.pointsAwarded, 0);
            return {
                id: s.id,
                title: s.title,
                status: s.status,
                questionCount: s.questions.length,
                answeredCount: answered,
                correctCount: correct,
                accuracy: answered ? Math.round((correct / answered) * 100) : 0,
                totalTimeSpentSec: totalTime,
                pointsAwarded: points,
                startedAt: s.startedAt,
                completedAt: s.completedAt,
            };
        });
    }

    // ============================================
    // MOCK EXAMS
    // ============================================
    private buildMockExams(
        attempts: Array<{
            id: string;
            status: string;
            score: number;
            correctAnswers: number;
            answeredQuestions: number;
            startedAt: Date;
            completedAt: Date | null;
            exam: { title: string; questions: Array<unknown> };
        }>,
    ): MockExamAnalyticsDto[] {
        return attempts.map((a) => ({
            id: a.id,
            title: a.exam.title,
            status: a.status,
            score: Math.round(a.score),
            correctAnswers: a.correctAnswers,
            answeredQuestions: a.answeredQuestions,
            totalQuestions: a.exam.questions.length,
            startedAt: a.startedAt,
            completedAt: a.completedAt,
        }));
    }

    // ============================================
    // ENGAGEMENT
    // ============================================
    private buildEngagement(
        flags: Array<{ context: string }>,
        highlights: Array<{ color: string }>,
    ): EngagementDto {
        const flagsByContext: Record<string, number> = {};
        for (const f of flags) {
            flagsByContext[f.context] = (flagsByContext[f.context] || 0) + 1;
        }
        const highlightsByColor: Record<string, number> = {};
        for (const h of highlights) {
            highlightsByColor[h.color] = (highlightsByColor[h.color] || 0) + 1;
        }
        return {
            totalFlags: flags.length,
            totalHighlights: highlights.length,
            flagsByContext,
            highlightsByColor,
        };
    }

    // ============================================
    // HELPERS
    // ============================================
    private daysBetween(a: Date, b: Date): number {
        const msPerDay = 24 * 60 * 60 * 1000;
        const aStart = new Date(a);
        aStart.setHours(0, 0, 0, 0);
        const bStart = new Date(b);
        bStart.setHours(0, 0, 0, 0);
        return Math.round((bStart.getTime() - aStart.getTime()) / msPerDay);
    }

    private startOfWeek(date: Date): Date {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const day = d.getDay(); // 0 = Sunday
        const diff = day === 0 ? 6 : day - 1; // Monday start
        d.setDate(d.getDate() - diff);
        return d;
    }
}