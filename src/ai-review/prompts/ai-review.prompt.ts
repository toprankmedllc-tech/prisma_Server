// ============================================
// AI Review Prompts — Quality Evaluation of USMLE Questions
// ============================================
// These prompts instruct the LLM to act as an expert USMLE question reviewer,
// evaluating questions for medical accuracy, USMLE style, hallucination risk,
// explanation quality, clinical relevance, and grammar.
// ============================================

export const AI_REVIEW_SYSTEM_PROMPT = `You are an expert USMLE question reviewer and medical educator with decades of experience in board exam preparation.

Your task is to evaluate USMLE-style questions for quality, accuracy, and hallucination risk.

You will be given:
1. A question (stem, choices, explanation, wrong options, metadata, etc.)
2. Retrieved medical context from a verified knowledge bank

You must evaluate the question against these criteria and output a structured JSON verdict.

## CRITERIA

### 1. Medical Accuracy (0-100)
Is every medical fact correct? Cross-check every claim against the provided context.
- 90-100: All facts are accurate and well-supported by the context
- 70-89: Minor inaccuracies or oversimplifications
- 50-69: Significant inaccuracies present
- 0-49: Multiple factual errors; question is fundamentally flawed

### 2. USMLE Style (0-100)
Does it match NBME/USMLE style?
- Buzzword: Short, keyword-driven, tests concept association
- Vignette: Full clinical scenario with patient profile, vitals, multi-step reasoning
- 90-100: Perfectly matches USMLE style for the given sourceType
- 70-89: Good but could be more aligned
- 50-69: Partially matches USMLE conventions
- 0-49: Does not resemble USMLE-style questions

### 3. Hallucination Risk (0-100)
How much fabricated or incorrect information is present?
- 0-10: No hallucinations. All claims are supported by the context.
- 11-30: Minor unsupported claims (e.g., slightly embellished statistics)
- 31-60: Moderate hallucination risk. Multiple claims not found in context.
- 61-100: High hallucination risk. Question fabricates significant medical information.

### 4. Explanation Quality (0-100)
Is the explanation clear, educational, and thorough?
- 90-100: Excellent. Explains WHY the correct answer is right AND WHY each wrong option is wrong.
- 70-89: Good explanation but could be more detailed about wrong options.
- 50-69: Adequate but missing key rationale.
- 0-49: Poor or missing explanation.

### 5. Clinical Relevance (0-100)
Is the tested concept high-yield for USMLE?
- 90-100: High-yield, commonly tested concept
- 70-89: Moderately relevant
- 50-69: Low-yield but still plausible
- 0-49: Not relevant to USMLE

### 6. Grammatical Quality (0-100)
Is the writing clear, professional, and free of errors?
- 90-100: Excellent writing, no errors
- 70-89: Minor typos or awkward phrasing
- 50-69: Several grammatical issues
- 0-49: Poor writing quality

## HALLUCINATION CHECKLIST
For each of the following, check if the question fabricates information:
- Does the explanation cite medical facts NOT in the provided context?
- Are any lab values, vitals, or statistics fabricated?
- Is the diagnosis-to-presentation mapping correct?
- Are drug names, doses, mechanisms accurate?
- Are any anatomical/physiological claims incorrect?
- Are buzzword associations correct (for buzzword questions)?
- Are the buzzwordCombo strings in wrongOptions accurate?

## VERDICT RULES
- PASS if: medicalAccuracy >= 70 AND hallucinationRisk < 30 AND usmleStyle >= 50
- FAIL otherwise

If FAIL, provide specific details on what needs to be fixed so the generation system can produce a better replacement.`;

export function buildAiReviewUserPrompt(
  question: any,
  context: string,
): string {
  const choiceLines = question.choices
    .map((c: any) => `${c.letter || ''}. ${c.text} [${c.isCorrect ? 'CORRECT' : 'INCORRECT'}]`)
    .join('\n');

  const wrongOptionLines = question.wrongOptions
    ? question.wrongOptions
        .map(
          (wo: any) =>
            `${wo.letter}. ${wo.text}\n   Explanation: ${wo.explanation || 'N/A'}\n   Buzzword Combo: ${wo.buzzwordCombo || 'N/A'}`,
        )
        .join('\n\n')
    : 'N/A';

  const vitalsJson = question.vitals
    ? JSON.stringify(
        {
          bloodPressure: question.vitals.bloodPressure,
          heartRate: question.vitals.heartRate,
          pulseOximetry: question.vitals.pulseOximetry,
          temperature: question.vitals.temperature,
          respiratoryRate: question.vitals.respiratoryRate,
        },
        null,
        2,
      )
    : 'N/A';

  return `Review the following USMLE question:

## Question Metadata
- ID: ${question.id}
- Source: ${question.source}
- Source Type: ${question.sourceType || 'N/A'}
- Topic: ${question.topic?.name || 'N/A'}
- Subject: ${question.topic?.subject?.name || 'N/A'}
- System: ${question.system || 'N/A'}
- Discipline: ${question.discipline || 'N/A'}
- Difficulty: ${question.difficulty}
- Cognitive Level: ${question.cognitiveLevel || 'N/A'}
- Trap Type: ${question.trapType || 'N/A'}

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

## Wrong Options with Explanations
${wrongOptionLines}

## Buzzword-Specific Data
${question.buzzwords?.length ? `Buzzwords: ${question.buzzwords.join(', ')}` : 'N/A'}
${question.buzzwordCombinationCorrect ? `Buzzword Pattern: ${question.buzzwordCombinationCorrect}` : 'N/A'}

## Vitals (if applicable)
${vitalsJson}

## Step-by-Step Reasoning
${question.stepByStepReasoning || 'N/A'}

## Educational Objective
${question.educationalObjective || 'N/A'}

## Related Concepts
${question.relatedConcepts?.join(', ') || 'N/A'}

## Verified Medical Context (from knowledge bank)
${context}

---

Output a JSON object with this EXACT structure — no extra fields, no markdown:

{
  "verdict": "PASS",
  "scores": {
    "medicalAccuracy": 85,
    "hallucinationRisk": 5,
    "usmleStyle": 90,
    "explanationQuality": 80,
    "clinicalRelevance": 75,
    "grammaticalQuality": 95
  },
  "feedback": {
    "usmleStyle": "The question follows the standard NBME vignette format well...",
    "medicalAccuracy": "All medical facts are accurate...",
    "hallucinationDetails": "No hallucinations detected. All claims are supported by the context.",
    "explanationQuality": "The explanation is clear but could elaborate on why option B is wrong...",
    "clinicalRelevance": "High-yield concept for Step 1...",
    "grammatical": "No issues found.",
    "general": "Good question overall, ready for publication."
  }
}`;
}