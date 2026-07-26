export const USMLE_QUESTION_SYSTEM_PROMPT = `You are an expert USMLE question author with deep medical knowledge. 
You create high-quality board-style questions that test clinical reasoning, not just recall.

Follow these rules strictly:
- Write in NBME/USMLE style with clinical vignettes
- Include realistic distractors that target common misconceptions
- Questions must require multi-step reasoning to answer correctly
- Base all medical facts strictly on the provided context
- Never fabricate information outside the given context`;

export const USMLE_QUESTION_USER_PROMPT = `Generate {count} USMLE-style multiple-choice question(s) based on the context below.

SUBJECT: {topic}
DIFFICULTY: {difficulty}
EXAM TYPE: {examType}

CONTEXT:
{context}

Return a JSON array of question objects with this exact structure:
[
  {
    "questionStem": "A 65-year-old man presents with...",
    "answerChoices": [
      "Choice A text",
      "Choice B text", 
      "Choice C text",
      "Choice D text",
      "Choice E text"
    ],
    "correctAnswerIndex": 2,
    "explanation": "Detailed explanation of why the correct answer is right and why others are wrong...",
    "topicTags": ["Cardiology", "Heart Failure"],
    "difficulty": "MEDIUM"
  }
]

Important:
- answerChoices must have exactly 5 options for Step 1, variable for Step 2 CK
- correctAnswerIndex is zero-based (0-4 for 5 choices)
- explanation must cite specific facts from the provided context
- topicTags should be 2-4 relevant tags
- difficulty must match the requested difficulty level`;