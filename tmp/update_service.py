#!/usr/bin/env python3
"""Update questions.service.ts - replace getReviewDashboardQuestions and add tracking methods"""

with open('/home/irfanyousuf/code/TrmLLC/prisma_server/src/questions/questions.service.ts', 'r') as f:
    content = f.read()

# ============================================
# 1. Replace the getReviewDashboardQuestions method
# ============================================

old_method_start = """    // ============================================
    // NEW: Get review dashboard questions (random, up to 20, by subject/topic)
    // ============================================
    async getReviewDashboardQuestions(filters: {
        subject?: string;
        topic?: string;
        limit?: number;
    }): Promise<ReviewDashboardItemDto[]> {
        const { subject, topic, limit = 20 } = filters;

        const where: any = {};
        const topicWhere: any = {};

        if (subject) {
            topicWhere.subject = {
                name: { equals: subject, mode: 'insensitive' },
            };
        }

        if (topic) {
            topicWhere.name = { equals: topic, mode: 'insensitive' };
        }

        if (Object.keys(topicWhere).length > 0) {
            where.topic = topicWhere;
        }

        // Get total count first
        const totalCount = await this.prisma.question.count({ where });

        if (totalCount === 0) {
            return [];
        }

        // Use raw query to get random questions efficiently
        const take = Math.min(limit, totalCount);
        const questions: any[] = await this.prisma.$queryRawUnsafe(`
            SELECT q.id, q.stem, q."sourceType", q.difficulty, q.reviewed, q.rejected, q."isPublished", q."createdAt",
                   t.id as topic_id, t.name as topic_name,
                   s.id as subject_id, s.name as subject_name
            FROM "Question" q
            JOIN "Topic" t ON t.id = q."topicId"
            JOIN "Subject" s ON s.id = t."subjectId"
            ${subject || topic ? 'WHERE ' + [
                subject ? `LOWER(s.name) = LOWER($1)` : null,
                topic ? `LOWER(t.name) = LOWER(${subject ? '$2' : '$1'})` : null,
            ].filter(Boolean).join(' AND ') : ''}
            ORDER BY RANDOM()
            LIMIT ${take}
        `, ...(subject ? [subject] : []), ...(topic ? [topic] : []));

        return questions.map((q: any) => ({
            id: q.id,
            stem: q.stem,
            sourceType: q.sourceType,
            difficulty: q.difficulty,
            reviewed: q.reviewed,
            rejected: q.rejected,
            isPublished: q.isPublished,
            createdAt: q.createdAt,
            topic: {
                id: q.topic_id,
                name: q.topic_name,
                subject: {
                    id: q.subject_id,
                    name: q.subject_name,
                },
            },
        }));
    }"""

new_method = """    // ============================================
    // NEW: Get review dashboard questions (random, up to 20, by subject/topic)
    // Excludes questions the user has already reviewed or skipped
    // ============================================
    async getReviewDashboardQuestions(
        userId: string,
        filters: {
            subject?: string;
            topic?: string;
            limit?: number;
        },
    ): Promise<ReviewDashboardItemDto[]> {
        const { subject, topic, limit = 20 } = filters;

        // 1. Get the user's excluded question IDs
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { reviewedQuestions: true, skippedQuestions: true },
        });
        const excludedIds = [
            ...(user?.reviewedQuestions ?? []),
            ...(user?.skippedQuestions ?? []),
        ];

        const where: any = {};
        const topicWhere: any = {};

        if (subject) {
            topicWhere.subject = {
                name: { equals: subject, mode: 'insensitive' },
            };
        }

        if (topic) {
            topicWhere.name = { equals: topic, mode: 'insensitive' };
        }

        if (Object.keys(topicWhere).length > 0) {
            where.topic = topicWhere;
        }

        if (excludedIds.length > 0) {
            where.id = { notIn: excludedIds };
        }

        // 2. Get total count of eligible questions
        const totalCount = await this.prisma.question.count({ where });
        if (totalCount === 0) {
            return [];
        }

        // 3. Get all eligible IDs (lightweight query, only id field)
        const eligibleIds = (
            await this.prisma.question.findMany({
                where,
                select: { id: true },
            })
        ).map((q) => q.id);

        // 4. Randomly select `limit` IDs
        const shuffled = eligibleIds.sort(() => Math.random() - 0.5);
        const selectedIds = shuffled.slice(0, Math.min(limit, shuffled.length));

        if (selectedIds.length === 0) {
            return [];
        }

        // 5. Fetch full question data with relations
        const questions = await this.prisma.question.findMany({
            where: { id: { in: selectedIds } },
            include: {
                topic: {
                    include: { subject: true },
                },
            },
        });

        // 6. Re-sort to match the shuffled order (findMany order is not guaranteed)
        const sortedQuestions = selectedIds.map((id) =>
            questions.find((q) => q.id === id),
        ).filter(Boolean);

        return sortedQuestions.map((q: any) => ({
            id: q.id,
            stem: q.stem,
            sourceType: q.sourceType,
            difficulty: q.difficulty,
            reviewed: q.reviewed,
            rejected: q.rejected,
            isPublished: q.isPublished,
            createdAt: q.createdAt,
            topic: {
                id: q.topic.id,
                name: q.topic.name,
                subject: {
                    id: q.topic.subject.id,
                    name: q.topic.subject.name,
                },
            },
        }));
    }"""

# Check if old method exists
if old_method_start in content:
    content = content.replace(old_method_start, new_method, 1)
    print("Replaced getReviewDashboardQuestions method")
else:
    print("ERROR: Could not find old getReviewDashboardQuestions method")
    # Debug: find approximate location
    idx = content.find('getReviewDashboardQuestions')
    if idx >= 0:
        print(f"Found at index {idx}")
        print(repr(content[idx-50:idx+50]))
    else:
        print("Method not found at all")

# ============================================
# 2. Add markAsReviewed and markAsSkipped methods
#    Insert them after the reviewQuestion method
# ============================================

# Find the end of the reviewQuestion method and the beginning of the getReviewDashboardQuestions method
# We'll insert right before the getReviewDashboardQuestions section comment

insertion_point = "    // ============================================\n    // NEW: Get review dashboard questions (random, up to 20, by subject/topic)\n    // Excludes questions the user has already reviewed or skipped"
# Try the new version first (after our replacement)
if insertion_point not in content:
    # Try the old version
    insertion_point = "    // ============================================\n    // NEW: Get review dashboard questions (random, up to 20, by subject/topic)\n    // ============================================"

tracking_methods = """
    // ============================================
    // NEW: Mark a question as reviewed by a user
    // ============================================
    async markAsReviewed(userId: string, questionId: string): Promise<void> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { reviewedQuestions: true, skippedQuestions: true },
        });

        if (!user) return;

        const updates: any = {};

        // Add to reviewed if not already present
        if (!user.reviewedQuestions.includes(questionId)) {
            updates.reviewedQuestions = { push: questionId };
        }

        // Remove from skipped if it was there
        if (user.skippedQuestions.includes(questionId)) {
            updates.skippedQuestions = user.skippedQuestions.filter((id) => id !== questionId);
        }

        if (Object.keys(updates).length > 0) {
            await this.prisma.user.update({
                where: { id: userId },
                data: updates,
            });
        }
    }

    // ============================================
    // NEW: Mark a question as skipped by a user
    // ============================================
    async markAsSkipped(userId: string, questionId: string): Promise<void> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { skippedQuestions: true },
        });

        if (!user) return;

        if (!user.skippedQuestions.includes(questionId)) {
            await this.prisma.user.update({
                where: { id: userId },
                data: {
                    skippedQuestions: { push: questionId },
                },
            });
        }
    }

"""

if insertion_point in content:
    content = content.replace(insertion_point, tracking_methods + insertion_point, 1)
    print("Added markAsReviewed and markAsSkipped methods")
else:
    print("ERROR: Could not find insertion point for tracking methods")
    # Debug
    idx2 = content.find('getReviewDashboardQuestions')
    if idx2 >= 0:
        print(f"Found at {idx2}")
        print(repr(content[idx2-100:idx2]))

# Write the updated file
with open('/home/irfanyousuf/code/TrmLLC/prisma_server/src/questions/questions.service.ts', 'w') as f:
    f.write(content)

print("File written successfully")