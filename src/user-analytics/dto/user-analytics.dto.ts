import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ============================================
// OVERVIEW
// ============================================
export class UserAnalyticsOverviewDto {
    @ApiProperty({ description: 'Total questions attempted across study + mock exams' })
    totalQuestionsAttempted!: number;

    @ApiProperty({ description: 'Total correct answers' })
    totalCorrect!: number;

    @ApiProperty({ description: 'Total incorrect answers' })
    totalIncorrect!: number;

    @ApiProperty({ description: 'Overall accuracy (0-100)' })
    accuracy!: number;

    @ApiProperty({ description: 'Total study sessions created' })
    totalStudySessions!: number;

    @ApiProperty({ description: 'Completed study sessions' })
    completedStudySessions!: number;

    @ApiProperty({ description: 'Total mock exam attempts' })
    totalMockExams!: number;

    @ApiProperty({ description: 'Completed mock exam attempts' })
    completedMockExams!: number;

    @ApiProperty({ description: 'Average mock exam score (0-100)' })
    avgMockScore!: number;

    @ApiProperty({ description: 'Total time spent answering questions (seconds)' })
    totalTimeSpentSec!: number;

    @ApiProperty({ description: 'Current daily streak (consecutive active days)' })
    currentStreak!: number;

    @ApiProperty({ description: 'Longest daily streak ever' })
    longestStreak!: number;

    @ApiProperty({ description: 'Total questions flagged' })
    totalFlags!: number;

    @ApiProperty({ description: 'Total highlights created' })
    totalHighlights!: number;

    @ApiProperty({ description: 'Days since last activity (0 = active today)' })
    daysSinceLastActivity!: number;
}

// ============================================
// ACTIVITY HEATMAP (daily)
// ============================================
export class ActivityHeatmapDayDto {
    @ApiProperty({ description: 'Date (YYYY-MM-DD)' })
    date!: string;

    @ApiProperty({ description: 'Questions answered on this date' })
    count!: number;

    @ApiProperty({ description: 'Correct answers on this date' })
    correct!: number;

    @ApiProperty({ description: 'Time spent on this date (seconds)' })
    timeSpentSec!: number;
}

export class ActivityHeatmapDto {
    @ApiProperty({ type: [ActivityHeatmapDayDto], description: 'Dense daily activity series' })
    days!: ActivityHeatmapDayDto[];

    @ApiProperty({ description: 'Total questions in the window' })
    total!: number;

    @ApiProperty({ description: 'Number of active days in the window' })
    activeDays!: number;
}

// ============================================
// STREAKS
// ============================================
export class StreakInfoDto {
    @ApiProperty({ description: 'Current streak in days' })
    current!: number;

    @ApiProperty({ description: 'Longest streak in days' })
    longest!: number;

    @ApiProperty({ description: 'Date of the last active day (YYYY-MM-DD) or null' })
    lastActiveDate!: string | null;

    @ApiProperty({ description: 'Whether the streak is still alive today' })
    isActiveToday!: boolean;
}

// ============================================
// PERFORMANCE BY TOPIC / SUBJECT
// ============================================
export class TopicPerformanceDto {
    @ApiProperty({ description: 'Topic ID' })
    topicId!: string;

    @ApiProperty({ description: 'Topic name' })
    topic!: string;

    @ApiProperty({ description: 'Subject name' })
    subject!: string;

    @ApiProperty({ description: 'Questions attempted' })
    attempted!: number;

    @ApiProperty({ description: 'Correct answers' })
    correct!: number;

    @ApiProperty({ description: 'Accuracy (0-100)' })
    accuracy!: number;
}

export class SubjectPerformanceDto {
    @ApiProperty({ description: 'Subject name' })
    subject!: string;

    @ApiProperty({ description: 'Questions attempted' })
    attempted!: number;

    @ApiProperty({ description: 'Correct answers' })
    correct!: number;

    @ApiProperty({ description: 'Accuracy (0-100)' })
    accuracy!: number;
}

// ============================================
// PERFORMANCE OVER TIME (weekly)
// ============================================
export class WeeklyPerformanceDto {
    @ApiProperty({ description: 'Week start date (YYYY-MM-DD)' })
    week!: string;

    @ApiProperty({ description: 'Questions attempted that week' })
    attempted!: number;

    @ApiProperty({ description: 'Correct answers that week' })
    correct!: number;

    @ApiProperty({ description: 'Accuracy (0-100)' })
    accuracy!: number;
}

// ============================================
// STUDY SESSIONS
// ============================================
export class StudySessionAnalyticsDto {
    @ApiProperty({ description: 'Session ID' })
    id!: string;

    @ApiProperty({ description: 'Session title' })
    title!: string;

    @ApiProperty({ description: 'Session status' })
    status!: string;

    @ApiProperty({ description: 'Questions in session' })
    questionCount!: number;

    @ApiProperty({ description: 'Questions answered' })
    answeredCount!: number;

    @ApiProperty({ description: 'Correct answers' })
    correctCount!: number;

    @ApiProperty({ description: 'Accuracy (0-100)' })
    accuracy!: number;

    @ApiProperty({ description: 'Total time spent (seconds)' })
    totalTimeSpentSec!: number;

    @ApiProperty({ description: 'Points awarded' })
    pointsAwarded!: number;

    @ApiProperty({ description: 'When the session started' })
    startedAt!: Date;

    @ApiPropertyOptional({ description: 'When the session completed' })
    completedAt!: Date | null;
}

// ============================================
// MOCK EXAMS
// ============================================
export class MockExamAnalyticsDto {
    @ApiProperty({ description: 'Exam attempt ID' })
    id!: string;

    @ApiProperty({ description: 'Exam title' })
    title!: string;

    @ApiProperty({ description: 'Attempt status' })
    status!: string;

    @ApiProperty({ description: 'Score (0-100)' })
    score!: number;

    @ApiProperty({ description: 'Correct answers' })
    correctAnswers!: number;

    @ApiProperty({ description: 'Answered questions' })
    answeredQuestions!: number;

    @ApiProperty({ description: 'Total questions in exam' })
    totalQuestions!: number;

    @ApiProperty({ description: 'When the attempt started' })
    startedAt!: Date;

    @ApiPropertyOptional({ description: 'When the attempt completed' })
    completedAt!: Date | null;
}

// ============================================
// ENGAGEMENT
// ============================================
export class EngagementDto {
    @ApiProperty({ description: 'Total flags created' })
    totalFlags!: number;

    @ApiProperty({ description: 'Total highlights created' })
    totalHighlights!: number;

    @ApiProperty({ description: 'Flags by context' })
    flagsByContext!: Record<string, number>;

    @ApiProperty({ description: 'Highlights by color' })
    highlightsByColor!: Record<string, number>;
}

// ============================================
// COMPREHENSIVE RESPONSE
// ============================================
export class UserAnalyticsDto {
    @ApiProperty({ description: 'User ID' })
    userId!: string;

    @ApiProperty({ description: 'High-level summary stats' })
    overview!: UserAnalyticsOverviewDto;

    @ApiProperty({ description: 'Daily activity heatmap' })
    heatmap!: ActivityHeatmapDto;

    @ApiProperty({ description: 'Current and longest streaks' })
    streaks!: StreakInfoDto;

    @ApiProperty({ type: [TopicPerformanceDto], description: 'Accuracy by topic' })
    byTopic!: TopicPerformanceDto[];

    @ApiProperty({ type: [SubjectPerformanceDto], description: 'Accuracy by subject' })
    bySubject!: SubjectPerformanceDto[];

    @ApiProperty({ type: [WeeklyPerformanceDto], description: 'Weekly accuracy trend' })
    weekly!: WeeklyPerformanceDto[];

    @ApiProperty({ type: [StudySessionAnalyticsDto], description: 'Study session history' })
    studySessions!: StudySessionAnalyticsDto[];

    @ApiProperty({ type: [MockExamAnalyticsDto], description: 'Mock exam history' })
    mockExams!: MockExamAnalyticsDto[];

    @ApiProperty({ description: 'Engagement signals (flags, highlights)' })
    engagement!: EngagementDto;
}