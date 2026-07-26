const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Get Excel file from command line
const vignetteFile = process.argv[2];

if (!vignetteFile) {
    console.error('❌ Please provide the vignette Excel file:');
    console.error('   node vignette-to-json.js vignette.xlsx');
    process.exit(1);
}

// Check if file exists
if (!fs.existsSync(vignetteFile)) {
    console.error(`❌ File not found: ${vignetteFile}`);
    process.exit(1);
}

// Create output directory
const outputDir = path.join(__dirname, 'output_json_vignettes');
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
        const match = line.trim().match(/^([A-E])[\)\.]\s*(.+)$/);
        if (match) {
            options.push({
                letter: match[1],
                text: match[2].trim()
            });
        }
    }

    if (options.length === 0) {
        const parts = optionsText.split(';').map(p => p.trim());
        parts.forEach((text, index) => {
            if (text) {
                options.push({
                    letter: String.fromCharCode(65 + index),
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

// ============================================
// PROCESS VIGNETTE QUESTIONS - SOFT VALIDATION
// ============================================

function processVignetteRow(row, rowIndex) {
    const topic = getTopic(row);

    // EXACT column names from your Excel - all with fallback to empty string
    const qid = row['QID\nV#'] || '';
    const system = row['System'] || '';
    const discipline = row['Discipline '] || '';
    const vignette = row['FULL Vignette Question'] || '';
    const patientProfile = row[' Patient Profile (Age, Sex, Relevant demographics such Pregnant or IV Drug User ETC...) (Separate by ; )'] || '';
    const chiefComplaint = row['Chief Complaint (If applicable, if not write NA)'] || '';
    const keySymptoms = row['Key Symptoms from Vignette (Separate by ; )'] || '';
    const vitalsText = row['Vitals if applicable (if not Write NA). \nCopy this format:\n\nBlood Pressure:\nHeart Rate:\nPulse Oximetry %: \nTemperature °C :'] || '';
    const labsText = row['Labs (Separate by ; )'] || '';
    const imagingText = row['Imaging Findings Mentioned if applicable (if not Write NA), Seperate different imaging with ;'] || '';
    const physicalExam = row['Physical Exam if applicable (if not Write NA)'] || '';
    const mainClue = row['Main Clue'] || '';
    const supportingClue = row['Supporting Clue'] || '';
    const leadInQuestion = row['Lead-in Question (e.g. Which of the following is the most appropriate next step in management?)'] || '';
    const optionsText = row['Options A-E\n\nCopy this format:\n\nA)\nB)\nC)\nD)\nE)'] || '';
    const correctAnswer = row['Correct Answer'] || '';
    const rationale = row['Correct Answer Rationale (Should be detailed) '] || '';
    const stepByStep = row['Step-by-Step Thought Process/Breakdown\n\nExample :\n1. Identify the key symptom: sudden tearing chest pain radiating to the back.\n2. Notice risk clues: severe hypertension and asymmetric arm blood pressures.\n3. Recognize the diagnosis: aortic dissection.\n4. Determine stability: patient is hemodynamically stable.\n5. Choose next test: CT angiography of the chest.\n6. Avoid traps: heparin worsens dissection bleeding; D-dimer is not confirmatory; TTE is not sensitive enough.'] || '';
    const wrongOption1 = row['Wrong option 1'] || '';
    const wrongOption1Explanation = row['Wrong option 1 Explanation '] || '';
    const wrongOption2 = row['Wrong option 2'] || '';
    const wrongOption2Explanation = row['Wrong option 2 Explanation '] || '';
    const wrongOption3 = row['Wrong option 3'] || '';
    const wrongOption3Explanation = row['Wrong option 3 Explanation '] || '';
    const wrongOption4 = row['Wrong option 4'] || '';
    const wrongOption4Explanation = row['Wrong option 4 Explanation '] || '';
    const educationalObjective = row['Educational Objective/Key Takeaway\n\nExample: Rapid diagnosis of aortic dissection with CT angiography is the critical next step in hemodynamically stable patients presenting with sudden, tearing chest pain and asymmetric pulses.'] || '';
    const tags = row['Tags / Keywords (Refer to the keyword document provided to you) '] || '';
    const cognitiveLevel = row['Cognitive Level'] || '';
    const difficulty = row['Question Difficulty '] || 'MEDIUM';
    const trapType = row['Trap Type '] || '';
    const relatedConcepts = row['3 Suggested Related Concepts (Separate by ; )\n(Example question was about Aortic Dissection, and the suggested concepts were Myocardial Infarction; Pericarditis; Pulmonary Embolism) '] || '';

    // Parse options - will return empty array if none found
    const parsedOptions = parseOptions(optionsText);
    const correctLetter = correctAnswer.trim().charAt(0) || '';

    // Build choices - empty if no options
    const choices = parsedOptions.map((opt, index) => ({
        letter: opt.letter,
        text: opt.text,
        isCorrect: opt.letter === correctLetter,
        order: index
    }));

    // Build wrong options
    const wrongOptions = [];
    const wrongTexts = [wrongOption1, wrongOption2, wrongOption3, wrongOption4];
    const wrongExplanations = [wrongOption1Explanation, wrongOption2Explanation, wrongOption3Explanation, wrongOption4Explanation];

    wrongTexts.forEach((text, idx) => {
        if (text) {
            wrongOptions.push({
                letter: String.fromCharCode(65 + idx),
                text: text,
                explanation: wrongExplanations[idx] || '',
                buzzwordCombo: null
            });
        }
    });

    // Build tags
    const tagList = [];
    if (topic && topic !== 'Unknown Topic') tagList.push(topic);
    if (system) tagList.push(system);
    if (discipline) tagList.push(discipline);
    tagList.push(...parseTags(keySymptoms));
    tagList.push(...parseTags(tags));
    tagList.push(...parseTags(relatedConcepts));
    const uniqueTags = [...new Set(tagList)];

    // Build the stem - combine vignette and lead-in question
    let stem = vignette;
    if (leadInQuestion) {
        stem = stem ? stem + '\n\n' + leadInQuestion : leadInQuestion;
    }

    return {
        // Basic Information
        stem: stem || '',
        leadInQuestion: leadInQuestion || '',
        explanation: rationale || '',
        qid: qid || '',

        // Source & Metadata
        source: 'HUMAN_GENERATED',
        sourceType: 'VIGNETTE',
        sourceRow: rowIndex + 2,
        sourceFile: vignetteFile,

        // Medical Classification
        topicName: topic || 'Unknown Topic',
        system: system || '',
        discipline: discipline || '',
        cognitiveLevel: cognitiveLevel || '',
        difficulty: mapDifficulty(difficulty),
        trapType: trapType || '',

        // Clinical Presentation
        patientProfile: patientProfile || '',
        chiefComplaint: (chiefComplaint !== 'NA' && chiefComplaint) || '',
        keySymptoms: parseTags(keySymptoms),
        vitals: parseVitals(vitalsText),
        labs: parseLabs(labsText),
        imaging: parseImaging(imagingText),
        physicalExam: (physicalExam !== 'NA' && physicalExam) || '',

        // Diagnostic Clues
        mainClue: mainClue || '',
        supportingClue: supportingClue || '',

        // Answer
        correctAnswerLetter: correctLetter || '',
        correctAnswerText: correctAnswer || '',
        choices: choices,

        // Detailed Explanations
        stepByStepReasoning: stepByStep || '',
        educationalObjective: educationalObjective || '',

        // Wrong Options
        wrongOptions: wrongOptions,

        // Buzzword Specific (not applicable for vignette)
        buzzwords: [],
        buzzwordCombinationCorrect: null,

        // Tags & Concepts
        tags: uniqueTags,
        relatedConcepts: parseTags(relatedConcepts),

        // Quality Reviews (empty since not present in this Excel)
        qualityReviews: null,

        // Images (not present in this Excel)
        suggestedImages: null,

        // Timestamps
        importedAt: new Date().toISOString(),
        importedBy: 'excel_import_script'
    };
}

// ============================================
// MAIN PROCESSING
// ============================================

async function processVignetteFile() {
    console.log('🚀 Starting Vignette Excel to JSON conversion...\n');
    console.log(`📊 Processing: ${vignetteFile}`);

    const allQuestions = [];
    let processedCount = 0;
    let emptyRowCount = 0;
    let errorCount = 0;

    try {
        const workbook = XLSX.readFile(vignetteFile);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet);

        console.log(`   Found ${rows.length} rows in Excel file\n`);

        for (let i = 0; i < rows.length; i++) {
            try {
                const row = rows[i];

                // Check if row is completely empty
                const hasAnyData = Object.values(row).some(value =>
                    value !== undefined &&
                    value !== null &&
                    String(value).trim() !== ''
                );

                if (!hasAnyData) {
                    emptyRowCount++;
                    continue;
                }

                const question = processVignetteRow(row, i);

                // Always add the question, even if some fields are empty
                allQuestions.push(question);
                processedCount++;

                // Log progress every 50 rows
                if (processedCount % 50 === 0) {
                    console.log(`   ✅ Processed ${processedCount} questions...`);
                }

            } catch (error) {
                errorCount++;
                console.log(`   ❌ Row ${i + 2}: Error - ${error.message}`);
                // Still add an empty question object
                allQuestions.push({
                    stem: '',
                    leadInQuestion: '',
                    explanation: '',
                    source: 'HUMAN_GENERATED',
                    sourceType: 'VIGNETTE',
                    sourceRow: i + 2,
                    sourceFile: vignetteFile,
                    topicName: 'Unknown Topic',
                    system: '',
                    discipline: '',
                    cognitiveLevel: '',
                    difficulty: 'MEDIUM',
                    trapType: '',
                    patientProfile: '',
                    chiefComplaint: '',
                    keySymptoms: [],
                    vitals: null,
                    labs: [],
                    imaging: [],
                    physicalExam: '',
                    mainClue: '',
                    supportingClue: '',
                    correctAnswerLetter: '',
                    correctAnswerText: '',
                    choices: [],
                    stepByStepReasoning: '',
                    educationalObjective: '',
                    wrongOptions: [],
                    buzzwords: [],
                    buzzwordCombinationCorrect: null,
                    tags: [],
                    relatedConcepts: [],
                    qualityReviews: null,
                    suggestedImages: null,
                    importedAt: new Date().toISOString(),
                    importedBy: 'excel_import_script'
                });
            }
        }
    } catch (error) {
        console.error(`   ❌ Failed to read vignette file: ${error.message}`);
        process.exit(1);
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 CONVERSION SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Total questions processed: ${processedCount}`);
    console.log(`📝 Total questions in JSON: ${allQuestions.length}`);
    console.log(`🗑️  Empty rows skipped: ${emptyRowCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('='.repeat(50));

    // Save to JSON file
    if (allQuestions.length > 0) {
        const baseName = path.basename(vignetteFile, '.xlsx');

        // Minified version
        const jsonFilePath = path.join(outputDir, `${baseName}.json`);
        fs.writeFileSync(jsonFilePath, JSON.stringify(allQuestions));
        console.log(`\n📁 Minified JSON: ${jsonFilePath}`);
        console.log(`   Size: ${(fs.statSync(jsonFilePath).size / 1024 / 1024).toFixed(2)} MB`);

        // Pretty version
        const prettyFilePath = path.join(outputDir, `${baseName}_pretty.json`);
        fs.writeFileSync(prettyFilePath, JSON.stringify(allQuestions, null, 2));
        console.log(`📁 Pretty JSON: ${prettyFilePath}`);
        console.log(`   Size: ${(fs.statSync(prettyFilePath).size / 1024 / 1024).toFixed(2)} MB`);

        // Sample version (first 5 questions)
        const sampleFilePath = path.join(outputDir, `${baseName}_sample.json`);
        const sampleCount = Math.min(5, allQuestions.length);
        fs.writeFileSync(sampleFilePath, JSON.stringify(allQuestions.slice(0, sampleCount), null, 2));
        console.log(`📁 Sample JSON: ${sampleFilePath}`);
        console.log(`   Contains ${sampleCount} questions (preview)`);

        // Stats file
        const statsFilePath = path.join(outputDir, `${baseName}_stats.json`);
        const stats = {
            totalQuestions: allQuestions.length,
            processedAt: new Date().toISOString(),
            sourceFile: vignetteFile,
            questionTypes: {
                vignette: processedCount
            },
            systems: [...new Set(allQuestions.map(q => q.system).filter(Boolean))],
            disciplines: [...new Set(allQuestions.map(q => q.discipline).filter(Boolean))],
            difficulties: {
                EASY: allQuestions.filter(q => q.difficulty === 'EASY').length,
                MEDIUM: allQuestions.filter(q => q.difficulty === 'MEDIUM').length,
                HARD: allQuestions.filter(q => q.difficulty === 'HARD').length
            },
            rowsWithStem: allQuestions.filter(q => q.stem && q.stem.length > 0).length,
            rowsWithChoices: allQuestions.filter(q => q.choices && q.choices.length > 0).length,
            rowsWithExplanation: allQuestions.filter(q => q.explanation && q.explanation.length > 0).length
        };
        fs.writeFileSync(statsFilePath, JSON.stringify(stats, null, 2));
        console.log(`📁 Stats: ${statsFilePath}`);

        // Also save as CSV for easy viewing in Excel
        const csvFilePath = path.join(outputDir, `${baseName}_summary.csv`);
        const csvHeaders = ['Row', 'Topic', 'Has Stem', 'Stem Length', 'Has Choices', 'Choice Count', 'Has Explanation', 'Difficulty'];
        const csvRows = allQuestions.map((q, idx) => [
            idx + 1,
            q.topicName || 'Unknown',
            q.stem && q.stem.length > 0 ? 'Yes' : 'No',
            (q.stem || '').length,
            q.choices && q.choices.length > 0 ? 'Yes' : 'No',
            (q.choices || []).length,
            q.explanation && q.explanation.length > 0 ? 'Yes' : 'No',
            q.difficulty || 'MEDIUM'
        ]);

        const csvContent = [
            csvHeaders.join(','),
            ...csvRows.map(row => row.join(','))
        ].join('\n');

        fs.writeFileSync(csvFilePath, csvContent);
        console.log(`📁 Summary CSV: ${csvFilePath}`);

    } else {
        console.log('\n❌ No questions were processed!');
        console.log('   Please check your Excel file format.');
    }

    console.log('\n🎉 Done!');
}

// Run the script
processVignetteFile().catch(console.error);