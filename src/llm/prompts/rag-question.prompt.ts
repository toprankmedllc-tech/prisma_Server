// ============================================
// RAG-Based USMLE Question Generation Prompts
// ============================================

export const RAG_QUESTION_SYSTEM_PROMPT = `You are an expert USMLE question author with deep medical knowledge.
You create high-quality board-style questions that test clinical reasoning.
You ALWAYS base your medical facts strictly on the provided context retrieved from a medical knowledge bank.
Never fabricate information outside the given context.

Follow these rules strictly:
- Write in NBME/USMLE style
- Include realistic distractors that target common misconceptions
- Questions must require reasoning to answer correctly
- Base all medical facts on the provided context
- Output ONLY valid JSON — no markdown, no explanations outside the JSON`;

// ============================================
// BUZZWORD PROMPT
// ============================================
export const BUZZWORD_QUESTION_USER_PROMPT = `Generate {count} USMLE-style BUZZWORD question(s) based on the context below.

TOPIC: {topic}
{topicExtras}
DIFFICULTY: {difficulty}
EXAM TYPE: {examType}

CONTEXT (use this as your sole medical knowledge source):
{context}

BUZZWORD questions are SHORT, direct questions that test a specific keyword or concept association.
They do NOT include a full clinical scenario — just a brief presentation with key buzzwords that point to the answer.

Output a JSON object with this EXACT structure — no extra fields, no markdown:

{
  "questions": [
    {
      "stem": "A patient presents with episodic sleepwalking and screaming during sleep. These episodes most likely occur during:",
      "leadInQuestion": null,
      "explanation": "NREM stage 3 is the deepest stage of sleep characterized by delta waves. Parasomnias such as sleepwalking and night terrors commonly occur during this stage, and patients typically do not remember the episodes afterward.",
      "system": "Behavioral Health & Nervous Systems/Special Senses",
      "discipline": "Physiology",
      "cognitiveLevel": "RECALL",
      "difficulty": "{difficulty}",
      "trapType": "Buzzword Trap",
      "patientProfile": null,
      "chiefComplaint": null,
      "keySymptoms": [],
      "physicalExam": null,
      "mainClue": null,
      "supportingClue": null,
      "correctAnswerLetter": "D",
      "correctAnswerText": "D. NREM stage 3",
      "choices": [
        { "letter": "A", "text": "REM sleep", "isCorrect": false, "order": 0 },
        { "letter": "B", "text": "NREM stage 1", "isCorrect": false, "order": 1 },
        { "letter": "C", "text": "NREM stage 2", "isCorrect": false, "order": 2 },
        { "letter": "D", "text": "NREM stage 3", "isCorrect": true, "order": 3 }
      ],
      "wrongOptions": [
        {
          "letter": "A",
          "text": "A. REM sleep",
          "explanation": "REM sleep is associated with vivid dreaming, muscle atonia, and rapid eye movements. Sleepwalking and night terrors occur during NREM stage 3, not REM sleep.",
          "buzzwordCombo": "Dreaming + muscle atonia + rapid eye movements = REM sleep"
        },
        {
          "letter": "B",
          "text": "B. NREM stage 1",
          "explanation": "NREM stage 1 is the lightest stage of sleep associated with theta waves. Parasomnias are not characteristic of this stage.",
          "buzzwordCombo": "Theta waves + light sleep + sleep onset = NREM stage 1"
        },
        {
          "letter": "C",
          "text": "C. NREM stage 2",
          "explanation": "NREM stage 2 is characterized by sleep spindles and K complexes. Sleepwalking is associated with NREM stage 3.",
          "buzzwordCombo": "Sleep spindles + K complexes + most total sleep = NREM stage 2"
        }
      ],
      "buzzwords": ["Sleepwalking", "Screaming during sleep", "No memory of events"],
      "buzzwordCombinationCorrect": "Delta waves + sleepwalking + night terrors = NREM stage 3",
      "stepByStepReasoning": null,
      "educationalObjective": null,
      "tags": ["{topic}", "Physiology", "Buzzword1", "Buzzword2"],
      "relatedConcepts": ["Concept1", "Concept2"]
    }
  ]
}

IMPORTANT RULES:
- answerChoices must have 4 options for Step 1, 4-5 for Step 2 CK
- correctAnswerLetter must match the letter of the correct choice (A, B, C, D, E)
- correctAnswerText must be in format "LETTER. Full text of correct answer"
- wrongOptions: ALWAYS include ALL incorrect choices with proper explanations and buzzwordCombo
- buzzwordCombo: A string like "Buzzword1 + buzzword2 + buzzword3 = Diagnosis" — this is CRITICAL for buzzword questions
- buzzwords: Array of 3-6 key buzzwords/phrases from the stem
- buzzwordCombinationCorrect: String like "Buzzword1 + buzzword2 + buzzword3 = Correct Answer"
- cognitiveLevel must be one of: RECALL, APPLICATION, CLINICAL_REASONING, ANALYSIS
- tags: include the topic name, system, discipline, and key buzzwords
- difficulty must match the requested difficulty level ({difficulty})
- discipline should match the most relevant medical discipline
- system should match the relevant body system
- trapType should be one of: "Buzzword Trap", "Similar Diagnosis Confusion", "Numerical Confusion", or null`;

// ============================================
// VIGNETTE PROMPT
// ============================================
export const VIGNETTE_QUESTION_USER_PROMPT = `Generate {count} USMLE-style CLINICAL VIGNETTE question(s) based on the context below.

TOPIC: {topic}
{topicExtras}
DIFFICULTY: {difficulty}
EXAM TYPE: {examType}
CLINICAL REPRESENTATION: {clinicalRep}

CONTEXT (use this as your sole medical knowledge source):
{context}

VIGNETTE questions are LONG clinical scenarios with detailed patient presentations.
They include a full patient profile, chief complaint, history, symptoms, physical exam findings, and labs.

Output a JSON object with this EXACT structure — no extra fields, no markdown:

{
  "questions": [
    {
      "stem": "A 45-year-old man with a history of hypertension and diabetes presents to the emergency department with acute onset of severe chest pain radiating to his left arm, associated with shortness of breath and diaphoresis. He has a 30-pack-year smoking history. His medications include metformin and lisinopril. On physical examination, his blood pressure is 160/95 mmHg, heart rate is 112/min, and oxygen saturation is 94% on room air. Lung auscultation reveals crackles in the bilateral bases. An ECG shows ST-segment elevation in leads V1-V4.\n\nWhich of the following is the most likely diagnosis?",
      "leadInQuestion": "Which of the following is the most likely diagnosis?",
      "explanation": "This patient presents with classic findings of an ST-Elevation Myocardial Infarction (STEMI). The chest pain radiating to the left arm, diaphoresis, and shortness of breath are hallmark symptoms. ST-segment elevation in the anterior leads (V1-V4) localizes the infarction to the anterior wall, typically supplied by the left anterior descending artery. Risk factors include hypertension, diabetes, smoking, and male gender. Immediate management includes aspirin, reperfusion therapy (percutaneous coronary intervention or fibrinolytics), and beta-blockers.",
      "system": "Cardiovascular System",
      "discipline": "Internal Medicine",
      "cognitiveLevel": "CLINICAL_REASONING",
      "difficulty": "{difficulty}",
      "trapType": "Similar Diagnosis Confusion",
      "patientProfile": "45-year-old man; hypertension; diabetes; 30-pack-year smoking history; medications: metformin, lisinopril",
      "chiefComplaint": "Acute severe chest pain radiating to left arm",
      "keySymptoms": ["Chest pain", "Shortness of breath", "Diaphoresis", "Radiation to left arm"],
      "physicalExam": "BP 160/95 mmHg, HR 112/min, O2 sat 94%, crackles in bilateral lung bases",
      "vitals": {
        "bloodPressure": "160/95",
        "heartRate": 112,
        "respiratoryRate": 22,
        "temperature": 37.0,
        "pulseOximetry": 94
      },
      "mainClue": "ST-segment elevation in leads V1-V4",
      "supportingClue": "Chest pain radiating to left arm with risk factors (HTN, DM, smoking)",
      "correctAnswerLetter": "C",
      "correctAnswerText": "C. ST-Elevation Myocardial Infarction (STEMI)",
      "choices": [
        { "letter": "A", "text": "Unstable Angina", "isCorrect": false, "order": 0 },
        { "letter": "B", "text": "Acute Pericarditis", "isCorrect": false, "order": 1 },
        { "letter": "C", "text": "ST-Elevation Myocardial Infarction (STEMI)", "isCorrect": true, "order": 2 },
        { "letter": "D", "text": "Aortic Dissection", "isCorrect": false, "order": 3 },
        { "letter": "E", "text": "Pulmonary Embolism", "isCorrect": false, "order": 4 }
      ],
      "wrongOptions": [
        {
          "letter": "A",
          "text": "A. Unstable Angina",
          "explanation": "Unstable angina presents with chest pain at rest but does NOT cause ST-segment elevation on ECG. Cardiac enzymes are typically normal. This patient has ST elevation, which indicates transmural ischemia.",
          "buzzwordCombo": null
        },
        {
          "letter": "B",
          "text": "B. Acute Pericarditis",
          "explanation": "Pericarditis causes diffuse ST-segment elevation with PR depression, and pain is typically pleuritic and positional, relieved by leaning forward. This patient's pain pattern and risk factors favor STEMI.",
          "buzzwordCombo": null
        },
        {
          "letter": "D",
          "text": "D. Aortic Dissection",
          "explanation": "Aortic dissection presents with sudden, severe tearing chest pain radiating to the back. ECG may be normal or show non-specific changes. This patient has clear ST elevation in a specific coronary distribution.",
          "buzzwordCombo": null
        },
        {
          "letter": "E",
          "text": "E. Pulmonary Embolism",
          "explanation": "Pulmonary embolism presents with acute dyspnea, pleuritic chest pain, and may show sinus tachycardia or right heart strain on ECG. ST elevation in anterior leads is not characteristic.",
          "buzzwordCombo": null
        }
      ],
      "buzzwords": [],
      "buzzwordCombinationCorrect": null,
      "stepByStepReasoning": "1. Identify the chief complaint: acute chest pain radiating to left arm with shortness of breath and diaphoresis → suggests acute coronary syndrome.\n2. Assess risk factors: hypertension, diabetes, smoking → all major risk factors for coronary artery disease.\n3. Interpret ECG findings: ST-segment elevation in leads V1-V4 → anterior wall STEMI.\n4. Rule out differentials: no tearing pain (aortic dissection), no pleuritic positional pain (pericarditis), no sudden dyspnea (PE).\n5. Therefore, the most likely diagnosis is STEMI.",
      "educationalObjective": "STEMI is diagnosed by ECG showing ST-segment elevation in anatomically contiguous leads. Immediate reperfusion therapy is the cornerstone of management.",
      "tags": ["{topic}", "Cardiovascular System", "Internal Medicine", "STEMI", "Chest Pain", "Acute Coronary Syndrome"],
      "relatedConcepts": ["Unstable Angina", "Acute Pericarditis", "Aortic Dissection", "Pulmonary Embolism"]
    }
  ]
}

IMPORTANT RULES:
- stems must be DETAILED clinical vignettes with patient age, demographics, history, symptoms, and relevant findings
- leadInQuestion: The specific question being asked (e.g., "Which of the following is the most likely diagnosis?")
- correctAnswerLetter must match the letter of the correct choice (A, B, C, D, E)
- correctAnswerText must be in format "LETTER. Full text of correct answer"
- choices: Include 4-5 options; set isCorrect: true for exactly one choice
- wrongOptions: ALWAYS include ALL incorrect choices with detailed explanations
- buzzwordCombo: MUST be null for vignette questions (not applicable)
- buzzwords: MUST be an empty array for vignette questions
- buzzwordCombinationCorrect: MUST be null for vignette questions
- vitals: Provide realistic vitals. For bloodPressure use string like "160/95", for numeric fields use numbers
- patientProfile: Brief description of the patient demographics and relevant history
- chiefComplaint: The primary symptom/reason for visit
- keySymptoms: Array of 3-8 key symptoms
- physicalExam: Relevant physical examination findings
- mainClue: The single most important diagnostic clue
- supportingClue: Additional clues that support the diagnosis
- stepByStepReasoning: Detailed clinical reasoning pathway (5-7 steps)
- educationalObjective: Key learning point (1-2 sentences)
- cognitiveLevel: For vignettes, use CLINICAL_REASONING or APPLICATION (rarely RECALL)
- trapType: One of: "Similar Diagnosis Confusion", "Buzzword Trap", "Numerical Confusion", or null
- discipline should match the most relevant medical discipline
- system should match the relevant body system
- tags: include the topic name, system, discipline, and key concepts
- relatedConcepts: 2-4 differential diagnoses or related conditions
- difficulty must match the requested difficulty level ({difficulty})`;