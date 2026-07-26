const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Get Excel files from command line
const buzzwordFile = process.argv[2];
const vignetteFile = process.argv[3];

if (!buzzwordFile || !vignetteFile) {
    console.error('❌ Please provide both Excel files:');
    console.error('   node index.js buzzword_questions.xlsx vignette_questions.xlsx');
    process.exit(1);
}

// Create output directory
const outputDir = path.join(__dirname, 'output_json');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// Parse options string into array of {letter, text}
function parseOptions(optionsText) {
    if (!optionsText) return [];

    const options = [];
    const lines = optionsText.split('\n').filter(line => line.trim());

    for (const line of lines) {
        // Match patterns like "A) text" or "A. text" or "A text"
        const match = line.trim().match(/^([A-E])[\)\.]\s*(.+)$/);
        if (match) {
            options.push({
                letter: match[1],
                text: match[2].trim()
            });
        }
    }

    // If no options parsed, try splitting by semicolon
    if (options.length === 0) {
        const parts = optionsText.split(';').map(p => p.trim());
        parts.forEach((text, index) => {
            if (text) {
                options.push({
                    letter: String.fromCharCode(65 + index), // A, B, C, D, E
                    text: text
                });
            }
        });
    }

    return options;
}

// Map difficulty to ENUM
function mapDifficulty(difficulty) {
    if (!difficulty) return 'MEDIUM';
    const diff = String(difficulty).toLowerCase().trim();
    if (diff.includes('easy') || diff === '1') return 'EASY';
    if (diff.includes('hard') || diff === '3' || diff === '5') return 'HARD';
    return 'MEDIUM';
}

// Parse tags from semicolon/comma separated string
function parseTags(tagsText) {
    if (!tagsText) return [];
    return tagsText
        .split(/[;,]/)
        .map(t => t.trim())
        .filter(t => t.length > 0);
}

// Parse vitals from text
function parseVitals(vitalsText) {
    if (!vitalsText || vitalsText === 'NA') return null;

    const vitals = {};
    const lines = vitalsText.split('\n').filter(line => line.trim());

    for (const line of lines) {
        const match = line.trim().match(/^([^:]+):\s*(.+)$/);
        if (match) {
            const key = match[1].trim().toLowerCase().replace(/\s/g, '_');
            const value = match[2].trim();

            if (key.includes('blood_pressure') || key.includes('blood pressure')) {
                vitals.bloodPressure = value;
            } else if (key.includes('heart_rate') || key.includes('heart rate')) {
                vitals.heartRate = parseInt(value) || null;
            } else if (key.includes('pulse_oximetry') || key.includes('pulse oximetry')) {
                vitals.pulseOximetry = parseInt(value) || null;
            } else if (key.includes('temperature')) {
                vitals.temperature = parseFloat(value) || null;
            } else if (key.includes('respiratory_rate') || key.includes('respiratory rate')) {
                vitals.respiratoryRate = parseInt(value) || null;
            }
        }
    }

    return Object.keys(vitals).length > 0 ? vitals : null;
}

// Parse labs from semicolon separated string
function parseLabs(labsText) {
    if (!labsText || labsText === 'NA') return [];
    return labsText.split(';').map(l => l.trim()).filter(l => l.length > 0);
}

// Parse imaging from semicolon separated string
function parseImaging(imagingText) {
    if (!imagingText || imagingText === 'NA') return [];
    return imagingText.split(';').map(i => i.trim()).filter(i => i.length > 0);
}

// Get topic name
function getTopic(row) {
    return row['Target Diagnosis'] || 'Unknown Topic';
}

// Build quality reviews object
function buildQualityReviews(row, type) {
    const reviews = {};

    if (type === 'vignette') {
        reviews.medicalAccuracy = row['Medical Accuracy  •⁠  ⁠Diagnosis/concept is medically correct •⁠  ⁠Explanations are accurate •⁠  ⁠No misleading or outdated information •⁠  ⁠Labs/imaging/vitals are realistic •⁠  ⁠Pharmacology and mechanisms are correct  '] || '';
        reviews.usmleStyle = row['USMLE Style & Quality  •⁠  ⁠Question resembles authentic NBME/UWorld style •⁠  ⁠Clinical reasoning is required •⁠  ⁠Not purely recall-based unless intended as buzzword question •⁠  ⁠Distractors are plausible •⁠  ⁠Stem gives enough information without being overly obvious •⁠  ⁠No unnecessary details/clues '] || '';
        reviews.explanationQuality = row['Explanation Quality  •⁠  ⁠Correct answer is clearly explained •⁠  ⁠Incorrect choices are briefly addressed when appropriate •⁠  ⁠High-yield learning points included •⁠  ⁠Explanation is concise but educational •⁠  ⁠No contradictions between explanation and answer '] || '';
        reviews.originality = row['Originality & AI Review  •⁠  ⁠Question does not appear copied from UWorld/NBME/First Aid •⁠  ⁠Wording appears original •⁠  ⁠No obvious AI hallucinations or fabricated facts •⁠  ⁠Question flows naturally and logically '] || '';
        reviews.grammar = row[' Grammar & Formatting  •⁠  ⁠Grammar/spelling acceptable •⁠  ⁠Formatting follows template •⁠  ⁠Answer choices consistent in style/length •⁠  ⁠No duplicate answer choices •⁠  ⁠No formatting errors '] || '';
        reviews.vignetteReview = row['VIGNETTE QUESTION-SPECIFIC REVIEW  •⁠  ⁠Clinical presentation is realistic •⁠  ⁠Difficulty level appropriate for USMLE Step 1 •⁠  ⁠Integration of pathology/pharmacology/physiology/microbiology where relevant •⁠  ⁠Question tests understanding rather than trivia •⁠  ⁠Lead-in question is clear '] || '';
    } else {
        reviews.explanationQuality = row['Explanation Quality  •⁠  ⁠Correct answer is clearly explained •⁠  ⁠Incorrect choices are briefly addressed when appropriate •⁠  ⁠High-yield learning points included •⁠  ⁠Explanation is concise but educational •⁠  ⁠No contradictions between explanation and answer '] || '';
        reviews.originality = row['Originality & AI Review  •⁠  ⁠Question does not appear copied from UWorld/NBME/First Aid •⁠  ⁠Wording appears original •⁠  ⁠No obvious AI hallucinations or fabricated facts •⁠  ⁠Question flows naturally and logically '] || '';
        reviews.grammar = row[' Grammar & Formatting  •⁠  ⁠Grammar/spelling acceptable •⁠  ⁠Formatting follows template •⁠  ⁠Answer choices consistent in style/length •⁠  ⁠No duplicate answer choices •⁠  ⁠No formatting errors '] || '';
        reviews.buzzwordReview = row['BUZZWORD QUESTION-SPECIFIC REVIEW  Verify: •⁠  ⁠Tests a high-yield association •⁠  ⁠Concise and clear •⁠  ⁠Not overly vague •⁠  ⁠Fact tested is relevant to Step 1  '] || '';
    }

    // Remove empty reviews
    Object.keys(reviews).forEach(key => {
        if (!reviews[key]) delete reviews[key];
    });

    return Object.keys(reviews).length > 0 ? reviews : null;
}

// ============================================
// PROCESS BUZZWORD QUESTIONS
// ============================================

function processBuzzwordRow(row, rowIndex) {
    const topic = getTopic(row);
    const buzzwordQuestion = row['Full Buzzword question '] || '';
    const optionsText = row['Options A-D\n\nCopy this format:\n\nA)\nB)\nC)\nD)'] || '';
    const correctAnswer = row['Correct Answer'] || '';
    const explanation = row['Correct Answer Explanation (Should be brief 1-3 sentences) '] || '';
    const buzzwords = row['Buzzwords Used in question (Separate by ;)'] || '';
    const tags = row['Tags / Keywords (Refer to the keyword document provided to you) '] || '';
    const difficulty = row['Question Difficulty '] || 'MEDIUM';
    const system = row['System'] || '';
    const discipline = row['Discipline '] || '';
    const cognitiveLevel = row['Cognitive Level'] || '';
    const trapType = row['Trap Type '] || '';
    const relatedConcepts = row['3 Suggested Related Concepts (Separate by ; )\n(Example question was about Aortic Dissection, and the suggested concepts were Myocardial Infarction; Pericarditis; Pulmonary Embolism) '] || '';
    const correctBuzzwordCombo = row['Buzzword Combo Correct Option (A+B+C= D) '] || '';
    const suggestedImages = row['Would you suggest any images to be added as part of the question stem?  Any images/tables needed for explanation?  Please outline below  '] || '';

    // Parse options
    const parsedOptions = parseOptions(optionsText);
    const correctLetter = correctAnswer.trim().charAt(0);

    // Build choices
    const choices = parsedOptions.map((opt, index) => ({
        letter: opt.letter,
        text: opt.text,
        isCorrect: opt.letter === correctLetter,
        order: index
    }));

    // Build wrong options
    const wrongOptions = [];
    const wrongTexts = [row['Wrong option 1'] || '', row['Wrong option 2'] || '', row['Wrong option 3'] || ''];
    const wrongExplanations = [
        row['Wrong option 1 Explanation (1-2 sentences) '] || '',
        row['Wrong option 2 Explanation (1-2 sentences) '] || '',
        row['Wrong option 3 Explanation (1-2 sentences) (A+B+C= D) '] || ''
    ];
    const wrongBuzzwordCombos = [
        row['Buzzword Combo Wrong Option 1 (A+B+C= D) '] || '',
        row['Buzzword Combo Wrong Option 2 (A+B+C= D) '] || '',
        row['Buzzword Combo Wrong Option 3 (A+B+C= D) '] || ''
    ];

    wrongTexts.forEach((text, idx) => {
        if (text) {
            wrongOptions.push({
                letter: String.fromCharCode(65 + idx), // A, B, C
                text: text,
                explanation: wrongExplanations[idx] || '',
                buzzwordCombo: wrongBuzzwordCombos[idx] || ''
            });
        }
    });

    // Build tags
    const tagList = [];
    if (topic) tagList.push(topic);
    if (system) tagList.push(system);
    if (discipline) tagList.push(discipline);
    tagList.push(...parseTags(buzzwords));
    tagList.push(...parseTags(tags));
    tagList.push(...parseTags(relatedConcepts));
    const uniqueTags = [...new Set(tagList)];

    return {
        // Basic Information
        stem: buzzwordQuestion,
        leadInQuestion: null,
        explanation: explanation,

        // Source & Metadata
        source: 'HUMAN_GENERATED',
        sourceType: 'BUZZWORD',
        sourceRow: rowIndex + 2,
        sourceFile: buzzwordFile,

        // Medical Classification
        topicName: topic,
        system: system || null,
        discipline: discipline || null,
        cognitiveLevel: cognitiveLevel || null,
        difficulty: mapDifficulty(difficulty),
        trapType: trapType || null,

        // Clinical Presentation (not applicable for buzzword)
        patientProfile: null,
        chiefComplaint: null,
        keySymptoms: [],
        vitals: null,
        labs: [],
        imaging: [],
        physicalExam: null,

        // Diagnostic Clues (not applicable for buzzword)
        mainClue: null,
        supportingClue: null,

        // Answer
        correctAnswerLetter: correctLetter || null,
        correctAnswerText: correctAnswer || null,
        choices: choices,

        // Detailed Explanations
        stepByStepReasoning: null,
        educationalObjective: null,

        // Wrong Options
        wrongOptions: wrongOptions,

        // Buzzword Specific
        buzzwords: parseTags(buzzwords),
        buzzwordCombinationCorrect: correctBuzzwordCombo || null,

        // Tags & Concepts
        tags: uniqueTags,
        relatedConcepts: parseTags(relatedConcepts),

        // Quality Reviews
        qualityReviews: buildQualityReviews(row, 'buzzword'),

        // Images
        suggestedImages: suggestedImages || null,

        // Timestamps
        importedAt: new Date().toISOString(),
        importedBy: 'excel_import_script'
    };
}

// ============================================
// PROCESS VIGNETTE QUESTIONS
// ============================================

function processVignetteRow(row, rowIndex) {
    const topic = getTopic(row);
    const vignette = row['FULL Vignette Question'] || '';
    const leadInQuestion = row['Lead-in Question (e.g. Which of the following is the most appropriate next step in management?)'] || '';
    const optionsText = row['Options A-E  Copy this format:  A) B) C) D) E)'] || '';
    const correctAnswer = row['Correct Answer'] || '';
    const rationale = row['Correct Answer Rationale (Should be detailed)'] || '';
    const tags = row['Tags / Keywords (Refer to the keyword document provided to you)'] || '';
    const difficulty = row['Question Difficulty '] || 'MEDIUM';
    const system = row['System'] || '';
    const discipline = row['Discipline '] || '';
    const cognitiveLevel = row['Cognitive Level'] || '';
    const trapType = row['Trap Type '] || '';
    const relatedConcepts = row['3 Suggested Related Concepts (Separate by ; ) (Example question was about Aortic Dissection, and the suggested concepts were Myocardial Infarction; Pericarditis; Pulmonary Embolism)'] || '';
    const suggestedImages = row['Would you suggest any images to be added as part of the question stem?  Any images/tables needed for explanation?  Please outline below  '] || '';

    // Clinical presentation
    const patientProfile = row['Patient Profile (Age, Sex, Relevant demographics such Pregnant or IV Drug User ETC...) (Separate by ; )'] || '';
    const chiefComplaint = row['Chief Complaint (If applicable, if not write NA)'] || '';
    const keySymptoms = row['Key Symptoms from Vignette (Separate by ; )'] || '';
    const vitalsText = row['Vitals if applicable (if not Write NA).  Copy this format:  Blood Pressure: Heart Rate: Pulse Oximetry %:  Temperature °C :'] || '';
    const labsText = row['Labs (Separate by ; )'] || '';
    const imagingText = row['Imaging Findings Mentioned if applicable (if not Write NA), Seperate different imaging with ;'] || '';
    const physicalExam = row['Physical Exam if applicable (if not Write NA)'] || '';
    const mainClue = row['Main Clue'] || '';
    const supportingClue = row['Supporting Clue'] || '';

    // Parse options
    const parsedOptions = parseOptions(optionsText);
    const correctLetter = correctAnswer.trim().charAt(0);

    // Build choices
    const choices = parsedOptions.map((opt, index) => ({
        letter: opt.letter,
        text: opt.text,
        isCorrect: opt.letter === correctLetter,
        order: index
    }));

    // Build wrong options
    const wrongOptions = [];
    const wrongTexts = [
        row['Wrong option 1'] || '',
        row['Wrong option 2'] || '',
        row['Wrong option 3'] || '',
        row['Wrong option 4'] || ''
    ];
    const wrongExplanations = [
        row['Wrong option 1 Explanation'] || '',
        row['Wrong option 2 Explanation'] || '',
        row['Wrong option 3 Explanation'] || '',
        row['Wrong option 4 Explanation'] || ''
    ];

    wrongTexts.forEach((text, idx) => {
        if (text) {
            wrongOptions.push({
                letter: String.fromCharCode(65 + idx), // A, B, C, D
                text: text,
                explanation: wrongExplanations[idx] || '',
                buzzwordCombo: null // Not applicable for vignette
            });
        }
    });

    // Build tags
    const tagList = [];
    if (topic) tagList.push(topic);
    if (system) tagList.push(system);
    if (discipline) tagList.push(discipline);
    tagList.push(...parseTags(keySymptoms));
    tagList.push(...parseTags(tags));
    tagList.push(...parseTags(relatedConcepts));
    const uniqueTags = [...new Set(tagList)];

    return {
        // Basic Information
        stem: vignette + (leadInQuestion ? '\n\n' + leadInQuestion : ''),
        leadInQuestion: leadInQuestion || null,
        explanation: rationale,

        // Source & Metadata
        source: 'HUMAN_GENERATED',
        sourceType: 'VIGNETTE',
        sourceRow: rowIndex + 2,
        sourceFile: vignetteFile,

        // Medical Classification
        topicName: topic,
        system: system || null,
        discipline: discipline || null,
        cognitiveLevel: cognitiveLevel || null,
        difficulty: mapDifficulty(difficulty),
        trapType: trapType || null,

        // Clinical Presentation
        patientProfile: patientProfile || null,
        chiefComplaint: (chiefComplaint !== 'NA' && chiefComplaint) || null,
        keySymptoms: parseTags(keySymptoms),
        vitals: parseVitals(vitalsText),
        labs: parseLabs(labsText),
        imaging: parseImaging(imagingText),
        physicalExam: (physicalExam !== 'NA' && physicalExam) || null,

        // Diagnostic Clues
        mainClue: mainClue || null,
        supportingClue: supportingClue || null,

        // Answer
        correctAnswerLetter: correctLetter || null,
        correctAnswerText: correctAnswer || null,
        choices: choices,

        // Detailed Explanations
        stepByStepReasoning: row['Step-by-Step Thought Process/Breakdown  Example : 1. Identify the key symptom: sudden tearing chest pain radiating to the back. 2. Notice risk clues: severe hypertension and asymmetric arm blood pressures. 3. Recognize the diagnosis: aortic dissection. 4. Determine stability: patient is hemodynamically stable. 5. Choose next test: CT angiography of the chest. 6. Avoid traps: heparin worsens dissection bleeding; D-dimer is not confirmatory; TTE is not sensitive enough.'] || null,
        educationalObjective: row['Educational Objective/Key Takeaway  Example: Rapid diagnosis of aortic dissection with CT angiography is the critical next step in hemodynamically stable patients presenting with sudden, tearing chest pain and asymmetric pulses.'] || null,

        // Wrong Options
        wrongOptions: wrongOptions,

        // Buzzword Specific (not applicable for vignette)
        buzzwords: [],
        buzzwordCombinationCorrect: null,

        // Tags & Concepts
        tags: uniqueTags,
        relatedConcepts: parseTags(relatedConcepts),

        // Quality Reviews
        qualityReviews: buildQualityReviews(row, 'vignette'),

        // Images
        suggestedImages: suggestedImages || null,

        // Timestamps
        importedAt: new Date().toISOString(),
        importedBy: 'excel_import_script'
    };
}

// ============================================
// MAIN PROCESSING
// ============================================

async function processExcelFiles() {
    console.log('🚀 Starting Excel to JSON conversion...\n');

    const allQuestions = [];
    let buzzwordCount = 0;
    let vignetteCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process Buzzword File
    console.log(`📊 Processing buzzword file: ${buzzwordFile}`);
    try {
        const buzzwordWorkbook = XLSX.readFile(buzzwordFile);
        const buzzwordSheet = buzzwordWorkbook.SheetNames[0];
        const buzzwordRows = XLSX.utils.sheet_to_json(buzzwordWorkbook.Sheets[buzzwordSheet]);

        console.log(`   Found ${buzzwordRows.length} rows`);

        for (let i = 0; i < buzzwordRows.length; i++) {
            try {
                const row = buzzwordRows[i];
                const question = processBuzzwordRow(row, i);

                // Validate required fields
                if (question.stem && question.choices.length > 0) {
                    allQuestions.push(question);
                    buzzwordCount++;
                } else {
                    skippedCount++;
                    console.log(`   ⚠️  Row ${i + 2}: Skipped (missing stem or choices)`);
                }
            } catch (error) {
                errorCount++;
                console.log(`   ❌ Row ${i + 2}: Error - ${error.message}`);
            }
        }
    } catch (error) {
        console.error(`   ❌ Failed to read buzzword file: ${error.message}`);
    }

    // Process Vignette File
    console.log(`\n📊 Processing vignette file: ${vignetteFile}`);
    try {
        const vignetteWorkbook = XLSX.readFile(vignetteFile);
        const vignetteSheet = vignetteWorkbook.SheetNames[0];
        const vignetteRows = XLSX.utils.sheet_to_json(vignetteWorkbook.Sheets[vignetteSheet]);

        console.log(`   Found ${vignetteRows.length} rows`);

        for (let i = 0; i < vignetteRows.length; i++) {
            try {
                const row = vignetteRows[i];
                const question = processVignetteRow(row, i);

                // Validate required fields
                if (question.stem && question.choices.length > 0) {
                    allQuestions.push(question);
                    vignetteCount++;
                } else {
                    skippedCount++;
                    console.log(`   ⚠️  Row ${i + 2}: Skipped (missing stem or choices)`);
                }
            } catch (error) {
                errorCount++;
                console.log(`   ❌ Row ${i + 2}: Error - ${error.message}`);
            }
        }
    } catch (error) {
        console.error(`   ❌ Failed to read vignette file: ${error.message}`);
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 CONVERSION SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Buzzword questions: ${buzzwordCount}`);
    console.log(`✅ Vignette questions: ${vignetteCount}`);
    console.log(`📝 Total questions: ${allQuestions.length}`);
    console.log(`⚠️  Skipped rows: ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('='.repeat(50));

    // Save to JSON file
    if (allQuestions.length > 0) {
        const jsonFilePath = path.join(outputDir, 'questions.json');
        fs.writeFileSync(jsonFilePath, JSON.stringify(allQuestions, null, 2));
        console.log(`\n📁 JSON saved to: ${jsonFilePath}`);
        console.log(`📦 File size: ${(fs.statSync(jsonFilePath).size / 1024 / 1024).toFixed(2)} MB`);

        // Also save a pretty version for human reading
        const prettyFilePath = path.join(outputDir, 'questions_pretty.json');
        fs.writeFileSync(prettyFilePath, JSON.stringify(allQuestions, null, 4));
        console.log(`📁 Pretty JSON saved to: ${prettyFilePath}`);

        // Save a sample file with first 5 questions
        const sampleFilePath = path.join(outputDir, 'questions_sample.json');
        fs.writeFileSync(sampleFilePath, JSON.stringify(allQuestions.slice(0, 5), null, 2));
        console.log(`📁 Sample JSON saved to: ${sampleFilePath}`);
    } else {
        console.log('\n❌ No questions were processed!');
    }

    console.log('\n🎉 Done!');
}

// Run the script
processExcelFiles().catch(console.error);