// ============================================
// AI Review Structural Auto-Rejection Utilities
// ============================================
// Prevent unnecessarily spending LLM tokens on questions that are structurally
// invalid. These checks mirror the stringent reviewer's hard rules, so obvious
// defects are rejected instantly without a model call.

export interface StructuralCheckInput {
  stem: string;
  leadInQuestion?: string | null;
  choices: { id?: string; letter?: string | null; order?: number; text: string; isCorrect?: boolean }[];
  wrongOptions?: { id?: string; letter?: string | null; text: string; explanation?: string | null }[];
  explanation?: string | null;
}

export interface StructuralIssue {
  rule: string;
  description: string;
}

const LETTER_RE = /(^|[\s(,;])([A-Ea-e])\s*[.)]/;

/**
 * Run quick structural checks and return the list of issues. Empty array = clean.
 */
export function detectStructuralIssues(q: StructuralCheckInput): StructuralIssue[] {
  const issues: StructuralIssue[] = [];
  const stem = `${q.stem || ''} ${q.leadInQuestion || ''}`.toLowerCase();
  const choiceTexts = (q.choices || []).map((c) => (c.text || '').trim()).filter(Boolean);
  const wrongTexts = (q.wrongOptions || []).map((w) => (w.text || '').trim()).filter(Boolean);
  const allTexts = [...choiceTexts, ...wrongTexts];

  // Rule: any empty choice/option
  const hasEmptyOption = (q.choices || []).some((c) => !((c.text || '').trim()));
  if (hasEmptyOption) {
    issues.push({ rule: 'EMPTY_OPTION', description: 'One or more answer options is empty.' });
  }

  // Rule: option text starts with an option letter like "A." / "B)"
  for (const [index, text] of allTexts.entries()) {
    if (LETTER_RE.test(text.substring(0, 4))) {
      issues.push({ rule: 'OPTION_LETTER', description: `Option ${index + 1} begins with an option letter label (e.g. "A.").` });
      break;
    }
  }

  // Rule: repeated / near-identical sentences across options
  const norm = (s: string) => s.replace(/[^a-z0-9]/g, '').toLowerCase();
  for (let i = 0; i < allTexts.length; i++) {
    for (let j = i + 1; j < allTexts.length; j++) {
      const a = norm(allTexts[i]);
      const b = norm(allTexts[j]);
      if (a.length > 40 && b.length > 40 && (a === b || a.includes(b) || b.includes(a))) {
        issues.push({ rule: 'REPEATED_CONTENT', description: `Options ${i + 1} and ${j + 1} contain repeated/identical text.` });
      }
    }
  }

  // Rule: sentence repeated verbatim within the same option
  for (const text of allTexts) {
    const sentences = text.split(/(?<=[.!?])\s+/).map(norm).filter((s) => s.length > 30);
    if (new Set(sentences).size < sentences.length) {
      issues.push({ rule: 'REPEATED_SENTENCE', description: 'A sentence is repeated verbatim within an option.' });
      break;
    }
  }

  // Rule: correct answer text leaked into the stem
  const correctText = (q.choices || []).find((c) => c.isCorrect)?.text;
  if (correctText) {
    const normCorrect = norm(correctText);
    if (normCorrect.length > 30) {
      const stemNorm = norm(stem);
      if (stemNorm.includes(normCorrect)) {
        issues.push({ rule: 'ANSWER_LEAK', description: 'The correct answer text appears inside the question stem.' });
      }
    }
  }

  return issues;
}