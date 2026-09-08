import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ExamReadinessDto,
  ScoreForecastDto,
  BurnoutAnalysisDto,
  KnowledgeHeatmapDto,
  DailyActivityPatternDto,
  StreakInfoDto,
} from './dto/dashboard.dto';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private prisma: PrismaService) {}

  async getExamReadiness(userId: string): Promise<ExamReadinessDto> {
    this.logger.log(`Generating exam readiness for user: ${userId}`);

    const [scoreForecast, burnoutAnalysis, knowledgeHeatmap, dailyActivityPatterns, streaks] = await Promise.all([
      this.calculateScoreForecast(userId),
      this.analyzeBurnoutRisk(userId),
      this.generateKnowledgeHeatmap(userId),
      this.generateDailyActivityPatterns(userId),
      this.generateStreaks(userId),
    ]);

    const overallReadiness = this.calculateOverallReadiness(scoreForecast, burnoutAnalysis, knowledgeHeatmap);

    return {
      scoreForecast,
      burnoutAnalysis,
      knowledgeHeatmap,
      dailyActivityPatterns,
      streaks,
      overallReadiness,
      // Convenience top-level fields for the frontend meter
      burnoutScore: burnoutAnalysis.burnoutScore,
      burnoutRisk: burnoutAnalysis.burnoutRisk,
    };
  }

  private async calculateScoreForecast(userId: string): Promise<ScoreForecastDto> {
    this.logger.debug(`Calculating score forecast for user: ${userId}`);

    // Get user stats
    const userStats = await this.prisma.userStats.findUnique({
      where: { userId },
    });

    // Get recent question responses (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentQuestions = await this.prisma.questionResponse.findMany({
      where: { 
        userId, 
        createdAt: { gte: thirtyDaysAgo } 
      },
      orderBy: { createdAt: 'desc' },
    });

    // If no data, return default values
    if (!userStats || recentQuestions.length === 0) {
      return {
        predictedScore: 180, // Baseline score
        confidenceInterval: { lower: 160, upper: 200 },
        trend: 'STABLE',
        lastUpdated: new Date(),
      };
    }

    // Calculate accuracy from recent questions
    const correctCount = recentQuestions.filter(q => q.isCorrect).length;
    const accuracy = recentQuestions.length > 0 ? correctCount / recentQuestions.length : 0;

    // Predict score based on accuracy (USMLE Step 1: 200-300 range)
    // This is a simplified model - in production, use ML-based prediction
    const predictedScore = Math.round(200 + (accuracy * 100) + (userStats.accuracy * 50));
    
    // Calculate trend (comparing first half vs second half of recent questions)
    const trend = this.calculateTrend(recentQuestions);

    // Calculate confidence interval based on sample size
    const sampleSizeFactor = Math.min(recentQuestions.length / 50, 1);
    const margin = Math.round(30 * (1 - sampleSizeFactor));

    return {
      predictedScore: Math.max(180, Math.min(300, predictedScore)),
      confidenceInterval: { 
        lower: Math.max(160, predictedScore - margin), 
        upper: Math.min(320, predictedScore + margin) 
      },
      trend,
      lastUpdated: new Date(),
    };
  }

  private async analyzeBurnoutRisk(userId: string): Promise<BurnoutAnalysisDto> {
    this.logger.debug(`Analyzing burnout risk for user: ${userId}`);

    // Get responses from last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const responses = await this.prisma.questionResponse.findMany({
      where: {
        userId,
        createdAt: { gte: sevenDaysAgo },
      },
      orderBy: { createdAt: 'desc' },
    });

    // If no data, return low risk with a neutral score
    if (responses.length === 0) {
      return {
        burnoutRisk: 'LOW',
        burnoutScore: 0,
        recommendation: 'Keep up the good work! Start practicing questions to build your readiness.',
        tips: this.buildBurnoutTips({ avgResponseTime: 0, errorRate: 0, avgSessionDuration: 0, longSessions: false }),
        metrics: {
          avgResponseTime: 0,
          errorRateTrend: 0,
          sessionDuration: 0,
        },
        lastUpdated: new Date(),
      };
    }

    // Calculate metrics
    const avgResponseTime = responses.reduce((sum, r) => sum + r.responseTime, 0) / responses.length;
    const errorRate = responses.filter(r => !r.isCorrect).length / responses.length;

    // Analyze session patterns
    const sessionDurations = this.calculateSessionDurations(responses);
    const avgSessionDuration = sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length;
    const longSessions = sessionDurations.some(d => d > 120);

    // Compute a 0-100 burnout score from weighted signals.
    // - Response time: 0s -> 0, 60s+ -> 100 (linear)
    // - Error rate: 0 -> 0, 0.8+ -> 100 (linear)
    // - Session duration: 0-60min -> 0, 180min+ -> 100 (linear)
    const timeScore = Math.min(100, Math.max(0, (avgResponseTime / 60000) * 100));
    const errorScore = Math.min(100, Math.max(0, (errorRate / 0.8) * 100));
    const sessionScore = Math.min(100, Math.max(0, ((avgSessionDuration - 60) / 120) * 100));
    const longSessionPenalty = longSessions ? 15 : 0;

    const burnoutScore = Math.round(
      Math.min(100, timeScore * 0.35 + errorScore * 0.35 + sessionScore * 0.2 + longSessionPenalty),
    );

    // Determine risk level from the numeric score
    let burnoutRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    let recommendation = 'Keep up the good work!';

    if (burnoutScore >= 70) {
      burnoutRisk = 'HIGH';
      recommendation = 'Take a break! Your performance indicates fatigue. Consider stepping away for a day or two.';
    } else if (burnoutScore >= 40) {
      burnoutRisk = 'MEDIUM';
      recommendation = 'Consider a short break to maintain performance. Your accuracy is declining.';
    }

    return {
      burnoutRisk,
      burnoutScore,
      recommendation,
      tips: this.buildBurnoutTips({ avgResponseTime, errorRate, avgSessionDuration, longSessions }),
      metrics: {
        avgResponseTime,
        errorRateTrend: errorRate,
        sessionDuration: avgSessionDuration,
      },
      lastUpdated: new Date(),
    };
  }

  /**
   * Build a tailored list of actionable tips based on which burnout signals
   * are elevated. Always includes a couple of general recovery tips.
   */
  private buildBurnoutTips(metrics: {
    avgResponseTime: number;
    errorRate: number;
    avgSessionDuration: number;
    longSessions: boolean;
  }): string[] {
    const tips: string[] = [];

    if (metrics.avgResponseTime > 45000) {
      tips.push('Your response time is slowing down — a classic fatigue signal. Step away for 15–20 minutes and come back fresh.');
    }
    if (metrics.errorRate > 0.6) {
      tips.push('Accuracy has dipped sharply. Switch to a lighter review mode (buzzwords or flashcards) instead of new hard questions.');
    } else if (metrics.errorRate > 0.4) {
      tips.push('Your error rate is climbing. Try reviewing your flagged questions before attempting new ones.');
    }
    if (metrics.longSessions || metrics.avgSessionDuration > 120) {
      tips.push('You are studying in long stretches. Break study time into 25–50 minute blocks with short breaks (Pomodoro).');
    }
    if (metrics.avgSessionDuration > 0 && metrics.avgSessionDuration <= 120) {
      tips.push('Keep sessions under 2 hours and take a 10-minute walk between blocks to protect focus.');
    }

    // General recovery tips
    tips.push('Prioritize 7–9 hours of sleep — consolidation happens while you rest.');
    tips.push('Hydrate and eat balanced meals; low blood sugar amplifies mental fatigue.');
    tips.push('Schedule one full rest day per week. Recovery is part of the study plan, not a reward.');

    return tips;
  }

  private async generateKnowledgeHeatmap(userId: string): Promise<KnowledgeHeatmapDto[]> {
    this.logger.debug(`Generating knowledge heatmap for user: ${userId}`);

    // Gather real attempt data from study sessions and mock exams.
    const [studyAttempts, examAttempts] = await Promise.all([
      this.getStudyAttempts(userId),
      this.getExamAttempts(userId),
    ]);
    const allAttempts = [...studyAttempts, ...this.flattenExamAttempts(examAttempts)];
    if (allAttempts.length === 0) return [];

    const questionIds = [...new Set(allAttempts.map((a) => a.questionId))];
    const questions = await this.prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: {
        id: true,
        topic: { select: { subject: { select: { name: true } } } },
      },
    });
    const qMap = new Map(questions.map((q) => [q.id, q]));

    // Group by organ system (using the question's subject as the organ system).
    const organSystemProficiency: Record<string, { correct: number; total: number }> = {};
    for (const a of allAttempts) {
      const q = qMap.get(a.questionId);
      if (!q) continue;
      const systemName = q.topic.subject.name;
      const entry = organSystemProficiency[systemName] || { correct: 0, total: 0 };
      entry.total += 1;
      if (a.isCorrect) entry.correct += 1;
      organSystemProficiency[systemName] = entry;
    }

    // Convert to DTO format: { systemName, percentage }
    const heatmap: KnowledgeHeatmapDto[] = Object.entries(organSystemProficiency).map(([systemName, stats]) => ({
      systemName,
      percentage: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : null,
    }));

    // Sort by percentage (highest first)
    heatmap.sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0));

    return heatmap;
  }

  private async getStudyAttempts(userId: string): Promise<Array<{ questionId: string; isCorrect: boolean }>> {
    const sessions = await this.prisma.studySession.findMany({
      where: { userId },
      select: {
        questions: {
          select: {
            questionId: true,
            answerAttempts: { select: { isCorrect: true } },
          },
        },
      },
    });
    const attempts: Array<{ questionId: string; isCorrect: boolean }> = [];
    for (const session of sessions) {
      for (const sq of session.questions) {
        for (const a of sq.answerAttempts) {
          attempts.push({ questionId: sq.questionId, isCorrect: a.isCorrect });
        }
      }
    }
    return attempts;
  }

  private async getExamAttempts(userId: string): Promise<Array<{ questionAttempts: unknown }>> {
    return this.prisma.examAttempt.findMany({
      where: { userId },
      select: { questionAttempts: true },
    });
  }

  private flattenExamAttempts(attempts: Array<{ questionAttempts: unknown }>): Array<{ questionId: string; isCorrect: boolean }> {
    const flat: Array<{ questionId: string; isCorrect: boolean }> = [];
    for (const attempt of attempts) {
      const records = attempt.questionAttempts as Array<Record<string, any>>;
      if (!Array.isArray(records)) continue;
      for (const record of records) {
        if (record.type === 'TIP' || !record.questionId) continue;
        flat.push({ questionId: record.questionId, isCorrect: Boolean(record.isCorrect) });
      }
    }
    return flat;
  }

  // ============================================
  // DAILY ACTIVITY PATTERNS — accuracy per day over the last 7 days
  // ============================================
  private async generateDailyActivityPatterns(userId: string): Promise<DailyActivityPatternDto[]> {
    const days = 7;
    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    since.setHours(0, 0, 0, 0);

    // Gather timestamped attempts from study sessions and mock exams.
    const [studyAttempts, examAttempts] = await Promise.all([
      this.getTimestampedStudyAttempts(userId),
      this.getTimestampedExamAttempts(userId),
    ]);
    const allAttempts = [...studyAttempts, ...examAttempts];

    // Group by date, tracking correct/total.
    const dayMap = new Map<string, { correct: number; total: number }>();
    for (const a of allAttempts) {
      if (a.attemptedAt < since) continue;
      const key = a.attemptedAt.toISOString().split('T')[0];
      const entry = dayMap.get(key) || { correct: 0, total: 0 };
      entry.total += 1;
      if (a.isCorrect) entry.correct += 1;
      dayMap.set(key, entry);
    }

    // Build a dense 7-day series.
    const patterns: DailyActivityPatternDto[] = [];
    const current = new Date(since);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    while (current <= today) {
      const key = current.toISOString().split('T')[0];
      const entry = dayMap.get(key);
      patterns.push({
        date: key,
        score: entry && entry.total > 0 ? Math.round((entry.correct / entry.total) * 100) : null,
      });
      current.setDate(current.getDate() + 1);
    }

    return patterns;
  }

  // ============================================
  // STREAKS — current and longest consecutive active days
  // ============================================
  private async generateStreaks(userId: string): Promise<StreakInfoDto> {
    const [studyAttempts, examAttempts] = await Promise.all([
      this.getTimestampedStudyAttempts(userId),
      this.getTimestampedExamAttempts(userId),
    ]);
    const allAttempts = [...studyAttempts, ...examAttempts];

    const activeDates = new Set<string>();
    for (const a of allAttempts) {
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

  private daysBetween(a: Date, b: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    const aStart = new Date(a);
    aStart.setHours(0, 0, 0, 0);
    const bStart = new Date(b);
    bStart.setHours(0, 0, 0, 0);
    return Math.round((bStart.getTime() - aStart.getTime()) / msPerDay);
  }

  private async getTimestampedStudyAttempts(userId: string): Promise<Array<{ isCorrect: boolean; attemptedAt: Date }>> {
    const sessions = await this.prisma.studySession.findMany({
      where: { userId },
      select: {
        questions: {
          select: {
            answerAttempts: { select: { isCorrect: true, attemptedAt: true } },
          },
        },
      },
    });
    const attempts: Array<{ isCorrect: boolean; attemptedAt: Date }> = [];
    for (const session of sessions) {
      for (const sq of session.questions) {
        for (const a of sq.answerAttempts) {
          attempts.push({ isCorrect: a.isCorrect, attemptedAt: a.attemptedAt });
        }
      }
    }
    return attempts;
  }

  private async getTimestampedExamAttempts(userId: string): Promise<Array<{ isCorrect: boolean; attemptedAt: Date }>> {
    const attempts = await this.prisma.examAttempt.findMany({
      where: { userId },
      select: { questionAttempts: true },
    });
    const flat: Array<{ isCorrect: boolean; attemptedAt: Date }> = [];
    for (const attempt of attempts) {
      const records = attempt.questionAttempts as Array<Record<string, any>>;
      if (!Array.isArray(records)) continue;
      for (const record of records) {
        if (record.type === 'TIP' || !record.questionId) continue;
        flat.push({
          isCorrect: Boolean(record.isCorrect),
          attemptedAt: record.answeredAt ? new Date(record.answeredAt) : new Date(),
        });
      }
    }
    return flat;
  }

  private calculateTrend(questions: any[]): 'IMPROVING' | 'DECLINING' | 'STABLE' {
    if (questions.length < 10) return 'STABLE';

    const midPoint = Math.floor(questions.length / 2);
    const firstHalf = questions.slice(0, midPoint);
    const secondHalf = questions.slice(midPoint);

    const firstAccuracy = firstHalf.filter(q => q.isCorrect).length / firstHalf.length;
    const secondAccuracy = secondHalf.filter(q => q.isCorrect).length / secondHalf.length;

    const difference = secondAccuracy - firstAccuracy;

    if (difference > 0.05) return 'IMPROVING';
    if (difference < -0.05) return 'DECLINING';
    return 'STABLE';
  }

  private calculateSessionDurations(responses: any[]): number[] {
    if (responses.length === 0) return [];

    // Group responses by session (within 30-minute windows)
    const sessions: number[][] = [];
    let currentSession: number[] = [responses[0].id];

    for (let i = 1; i < responses.length; i++) {
      const timeDiff = new Date(responses[i].createdAt).getTime() - 
                       new Date(responses[i-1].createdAt).getTime();
      
      if (timeDiff > 30 * 60 * 1000) { // 30 minutes
        sessions.push(currentSession);
        currentSession = [responses[i].id];
      } else {
        currentSession.push(responses[i].id);
      }
    }
    
    sessions.push(currentSession);

    // Calculate session durations in minutes
    return sessions.map(session => {
      if (session.length === 1) return 1; // Minimum 1 minute
      
      // Find the actual responses for this session
      const sessionResponses = responses.filter(r => session.includes(r.id));
      const duration = new Date(sessionResponses[sessionResponses.length-1].createdAt).getTime() - 
                       new Date(sessionResponses[0].createdAt).getTime();
      
      return Math.max(1, Math.round(duration / 60000)); // Convert to minutes
    });
  }

  private calculateOverallReadiness(
    scoreForecast: ScoreForecastDto,
    burnoutAnalysis: BurnoutAnalysisDto,
    knowledgeHeatmap: KnowledgeHeatmapDto[],
  ): number {
    // Weighted scoring: 40% score, 30% burnout risk, 30% knowledge coverage
    
    // Score component (normalized to 0-100)
    const scoreComponent = Math.min(100, (scoreForecast.predictedScore - 180) / 1.2);

    // Burnout component: invert the 0-100 burnout score so higher burnout lowers readiness
    const burnoutComponent = 100 - burnoutAnalysis.burnoutScore;
    
    // Knowledge component
    const knowledgeComponent = knowledgeHeatmap.length > 0 ?
      knowledgeHeatmap.reduce((sum, k) => sum + (k.percentage ?? 0), 0) / knowledgeHeatmap.length : 50;

    // Calculate weighted average
    const overallReadiness = (scoreComponent * 0.4 + burnoutComponent * 0.3 + knowledgeComponent * 0.3);
    
    return Math.round(overallReadiness);
  }
}
