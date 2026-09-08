// ============================================
// AI Review Verification Pass — Second Opinion
// ============================================
// After the primary review produces a verdict, an independent second pass
// re-examines the question and the primary verdict to catch false PASS/FAIL.
// This reduces the "rubber-stamp" problem where the reviewer approves a
// defective question.

export const AI_REVIEW_VERIFY_SYSTEM_PROMPT = `You are a second, independent USMLE question reviewer. A first reviewer has already produced a verdict on a question. Your job is to independently verify whether that verdict is correct.

You are skeptical and rigorous. You must NOT simply agree with the first reviewer. Form your own judgment.

You will be given:
1. The question (stem, choices, explanation, wrong options, metadata)
2. The first reviewer's verdict and scores
3. Retrieved medical context from a verified knowledge bank

## YOUR TASK
Independently determine whether the question is PASS-worthy or FAIL-worthy, then state whether you AGREE or DISAGREE with the first reviewer.

A question is PASS-worthy ONLY if ALL of these hold:
- Exactly ONE clearly correct answer, and the marked correct answer is the only defensible one.
- The stem contains enough information to answer WITHOUT the explanation.
- No answer leak, no ambiguity, no multiple defensible answers.
- All medical facts are correct and supported by the provided context.
- The explanation is consistent with the correct answer and explains the wrong options.
- No fabricated lab values, vitals, drug doses, or statistics.

If ANY of these fail, the question is FAIL-worthy.

## OUTPUT
Output a JSON object with this EXACT structure:

{
  "verdict": "PASS" | "FAIL",
  "agreesWithFirstReviewer": true | false,
  "confidence": 0-100,
  "reason": "Concise explanation of your independent judgment and why you agree or disagree with the first reviewer."
}`;

export function buildVerifyUserPrompt(
  question: any,
  firstReview: { verdict: string; scores: Record<string, number>; feedback: Record<string, string | undefined> },
  context: string,
): string {
  const choiceLines = question.choices
    .map((c: any) => `${c.letter || ''}. ${c.text} [${c.isCorrect ? 'CORRECT' : 'INCORRECT'}]`)
    .join('\n');

  const vitalsJson = question.vitals
    ? JSON.stringify({
        bloodPressure: question.vitals.bloodPressure,
        heartRate: question.vitals.heartRate,
        pulseOximetry: question.vitals.pulseOximetry,
        temperature: question.vitals.temperature,
        respiratoryRate: question.vitals.respiratoryRate,
      })
    : 'N/A';

  return `Independently verify this USMLE question and the first reviewer's verdict.

## First Reviewer's Verdict
- Verdict: ${firstReview.verdict}
- Scores: ${JSON.stringify(firstReview.scores)}
- General feedback: ${firstReview.feedback.general || 'N/A'}

## Question Metadata
- ID: ${question.id}
- Source Type: ${question.sourceType || 'N/A'}
- Topic: ${question.topic?.name || 'N/A'}
- Subject: ${question.topic?.subject?.name || 'N/A'}
- Difficulty: ${question.difficulty}

## Stem
${question.stem}

## Lead-in Question
${question.leadInQuestion || 'N/A'}

## Choices
${choiceLines}

## Correct Answer
${question.correctAnswerLetter || '?'}. ${question.correctAnswerText || 'N/A'}

## Explanation
${question.explanation}

## Vitals (if applicable)
${vitalsJson}

## Step-by-Step Reasoning
${question.stepByStepReasoning || 'N/A'}

## Verified Medical Context (from knowledge bank)
${context}

---

Output a JSON object with this EXACT structure — no extra fields, no markdown:

{
  "verdict": "PASS",
  "agreesWithFirstReviewer": true,
  "confidence": 90,
  "reason": "The question has a single defensible answer, all facts are supported by the context, and the explanation is consistent."
}`;
}