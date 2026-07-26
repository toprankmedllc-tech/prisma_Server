const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Get the Excel file from command line
const excelFile = process.argv[2];
if (!excelFile) {
    console.error('❌ Please provide the Excel file path:');
    console.error('   node index.js questions.xlsx');
    process.exit(1);
}

// Check if file exists in current directory
const excelPath = path.join(__dirname, excelFile);
if (!fs.existsSync(excelPath)) {
    console.error(`❌ File not found: ${excelPath}`);
    process.exit(1);
}

// Create output directory for markdown files
const outputDir = path.join(__dirname, 'output_markdown');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Read workbook
const workbook = XLSX.readFile(excelPath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(worksheet);

console.log(`📊 Found ${rows.length} rows in Excel file`);
console.log(`📁 Output directory: ${outputDir}\n`);

// Process each row
let successCount = 0;
let errorCount = 0;

rows.forEach((row, index) => {
    try {
        // Extract data with exact column names from your Excel
        const qid = row['QID V#'] || row['QID'] || '';
        const system = row['System'] || '';
        const discipline = row['Discipline '] || '';
        const topic = row['Target Diagnosis'] || 'Unknown Topic';
        const vignette = row['FULL Vignette Question'] || '';
        const patientProfile = row['Patient Profile (Age, Sex, Relevant demographics such Pregnant or IV Drug User ETC...) (Separate by ; )'] || '';
        const chiefComplaint = row['Chief Complaint (If applicable, if not write NA)'] || '';
        const keySymptoms = row['Key Symptoms from Vignette (Separate by ; )'] || '';
        const vitals = row['Vitals if applicable (if not Write NA).  Copy this format:  Blood Pressure: Heart Rate: Pulse Oximetry %:  Temperature °C :'] || '';
        const labs = row['Labs (Separate by ; )'] || '';
        const imaging = row['Imaging Findings Mentioned if applicable (if not Write NA), Seperate different imaging with ;'] || '';
        const physicalExam = row['Physical Exam if applicable (if not Write NA)'] || '';
        const mainClue = row['Main Clue'] || '';
        const supportingClue = row['Supporting Clue'] || '';
        const leadInQuestion = row['Lead-in Question (e.g. Which of the following is the most appropriate next step in management?)'] || '';
        const options = row['Options A-E  Copy this format:  A) B) C) D) E)'] || '';
        const correctAnswer = row['Correct Answer'] || '';
        const rationale = row['Correct Answer Rationale (Should be detailed)'] || '';
        const stepByStep = row['Step-by-Step Thought Process/Breakdown  Example : 1. Identify the key symptom: sudden tearing chest pain radiating to the back. 2. Notice risk clues: severe hypertension and asymmetric arm blood pressures. 3. Recognize the diagnosis: aortic dissection. 4. Determine stability: patient is hemodynamically stable. 5. Choose next test: CT angiography of the chest. 6. Avoid traps: heparin worsens dissection bleeding; D-dimer is not confirmatory; TTE is not sensitive enough.'] || '';
        const wrongOption1 = row['Wrong option 1'] || '';
        const wrongOption1Explanation = row['Wrong option 1 Explanation'] || '';
        const wrongOption2 = row['Wrong option 2'] || '';
        const wrongOption2Explanation = row['Wrong option 2 Explanation'] || '';
        const wrongOption3 = row['Wrong option 3'] || '';
        const wrongOption3Explanation = row['Wrong option 3 Explanation'] || '';
        const wrongOption4 = row['Wrong option 4'] || '';
        const wrongOption4Explanation = row['Wrong option 4 Explanation'] || '';
        const educationalObjective = row['Educational Objective/Key Takeaway  Example: Rapid diagnosis of aortic dissection with CT angiography is the critical next step in hemodynamically stable patients presenting with sudden, tearing chest pain and asymmetric pulses.'] || '';
        const tags = row['Tags / Keywords (Refer to the keyword document provided to you)'] || '';
        const cognitiveLevel = row['Cognitive Level'] || '';
        const difficulty = row['Question Difficulty '] || '';
        const trapType = row['Trap Type '] || '';
        const relatedConcepts = row['3 Suggested Related Concepts (Separate by ; ) (Example question was about Aortic Dissection, and the suggested concepts were Myocardial Infarction; Pericarditis; Pulmonary Embolism)'] || '';

        // Quality check columns (optional, might contain review comments)
        const medicalAccuracy = row['Medical Accuracy  •⁠  ⁠Diagnosis/concept is medically correct •⁠  ⁠Explanations are accurate •⁠  ⁠No misleading or outdated information •⁠  ⁠Labs/imaging/vitals are realistic •⁠  ⁠Pharmacology and mechanisms are correct  '] || '';
        const usmleStyle = row['USMLE Style & Quality  •⁠  ⁠Question resembles authentic NBME/UWorld style •⁠  ⁠Clinical reasoning is required •⁠  ⁠Not purely recall-based unless intended as buzzword question •⁠  ⁠Distractors are plausible •⁠  ⁠Stem gives enough information without being overly obvious •⁠  ⁠No unnecessary details/clues '] || '';
        const explanationQuality = row['Explanation Quality  •⁠  ⁠Correct answer is clearly explained •⁠  ⁠Incorrect choices are briefly addressed when appropriate •⁠  ⁠High-yield learning points included •⁠  ⁠Explanation is concise but educational •⁠  ⁠No contradictions between explanation and answer '] || '';
        const originality = row['Originality & AI Review  •⁠  ⁠Question does not appear copied from UWorld/NBME/First Aid •⁠  ⁠Wording appears original •⁠  ⁠No obvious AI hallucinations or fabricated facts •⁠  ⁠Question flows naturally and logically '] || '';
        const grammar = row[' Grammar & Formatting  •⁠  ⁠Grammar/spelling acceptable •⁠  ⁠Formatting follows template •⁠  ⁠Answer choices consistent in style/length •⁠  ⁠No duplicate answer choices •⁠  ⁠No formatting errors '] || '';
        const vignetteReview = row['VIGNETTE QUESTION-SPECIFIC REVIEW  •⁠  ⁠Clinical presentation is realistic •⁠  ⁠Difficulty level appropriate for USMLE Step 1 •⁠  ⁠Integration of pathology/pharmacology/physiology/microbiology where relevant •⁠  ⁠Question tests understanding rather than trivia •⁠  ⁠Lead-in question is clear '] || '';

        // Skip empty rows
        if (!vignette && !leadInQuestion) {
            console.log(`⚠️  Row ${index + 2}: Skipping (empty content)`);
            return;
        }

        // Build the markdown content
        let mdContent = `# ${topic}\n\n`;

        // Add metadata section
        mdContent += `## Metadata\n\n`;
        mdContent += `| Field | Value |\n`;
        mdContent += `|-------|-------|\n`;
        mdContent += `| QID | ${qid || 'N/A'} |\n`;
        mdContent += `| System | ${system || 'N/A'} |\n`;
        mdContent += `| Discipline | ${discipline || 'N/A'} |\n`;
        mdContent += `| Difficulty | ${difficulty || 'N/A'} |\n`;
        mdContent += `| Cognitive Level | ${cognitiveLevel || 'N/A'} |\n`;
        mdContent += `| Trap Type | ${trapType || 'N/A'} |\n\n`;

        // Patient information
        if (patientProfile) {
            mdContent += `## Patient Profile\n\n${patientProfile}\n\n`;
        }

        if (chiefComplaint && chiefComplaint !== 'NA') {
            mdContent += `## Chief Complaint\n\n${chiefComplaint}\n\n`;
        }

        // Clinical presentation
        if (vignette) {
            mdContent += `## Vignette\n\n${vignette}\n\n`;
        }

        if (keySymptoms) {
            mdContent += `## Key Symptoms\n\n${keySymptoms}\n\n`;
        }

        // Clinical findings
        if (vitals && vitals !== 'NA') {
            mdContent += `## Vitals\n\n${vitals}\n\n`;
        }

        if (labs) {
            mdContent += `## Labs\n\n${labs}\n\n`;
        }

        if (imaging && imaging !== 'NA') {
            mdContent += `## Imaging Findings\n\n${imaging}\n\n`;
        }

        if (physicalExam && physicalExam !== 'NA') {
            mdContent += `## Physical Exam\n\n${physicalExam}\n\n`;
        }

        // Clues
        if (mainClue) {
            mdContent += `## Main Clue\n\n${mainClue}\n\n`;
        }

        if (supportingClue) {
            mdContent += `## Supporting Clue\n\n${supportingClue}\n\n`;
        }

        // Question
        if (leadInQuestion) {
            mdContent += `## Question\n\n${leadInQuestion}\n\n`;
        }

        // Options
        if (options) {
            mdContent += `## Answer Options\n\n${options}\n\n`;
        }

        // Correct answer and explanation
        if (correctAnswer) {
            mdContent += `## Correct Answer\n\n${correctAnswer}\n\n`;
        }

        if (rationale) {
            mdContent += `## Explanation\n\n${rationale}\n\n`;
        }

        // Step by step reasoning
        if (stepByStep) {
            mdContent += `## Step-by-Step Reasoning\n\n${stepByStep}\n\n`;
        }

        // Wrong options explanations
        let wrongOptionsSection = '';
        if (wrongOption1) {
            wrongOptionsSection += `## Wrong Options\n\n`;
            wrongOptionsSection += `### ${wrongOption1}\n\n`;
            wrongOptionsSection += `${wrongOption1Explanation || '*No explanation provided in source data*'}\n\n`;
        }
        if (wrongOption2) {
            wrongOptionsSection += `### ${wrongOption2}\n\n`;
            wrongOptionsSection += `${wrongOption2Explanation || '*No explanation provided in source data*'}\n\n`;
        }
        if (wrongOption3) {
            wrongOptionsSection += `### ${wrongOption3}\n\n`;
            wrongOptionsSection += `${wrongOption3Explanation || '*No explanation provided in source data*'}\n\n`;
        }
        if (wrongOption4) {
            wrongOptionsSection += `### ${wrongOption4}\n\n`;
            wrongOptionsSection += `${wrongOption4Explanation || '*No explanation provided in source data*'}\n\n`;
        }
        if (wrongOptionsSection) {
            mdContent += wrongOptionsSection;
        }

        // Educational objective
        if (educationalObjective) {
            mdContent += `## Educational Objective\n\n${educationalObjective}\n\n`;
        }

        // Related concepts
        if (relatedConcepts) {
            mdContent += `## Related Concepts\n\n${relatedConcepts}\n\n`;
        }

        // Tags
        if (tags) {
            mdContent += `## Tags\n\n${tags}\n\n`;
        }

        // Quality review sections (optional - only include if they have content)
        let qualitySection = '';
        if (medicalAccuracy) {
            qualitySection += `## Medical Accuracy Review\n\n${medicalAccuracy}\n\n`;
        }
        if (usmleStyle) {
            qualitySection += `## USMLE Style Review\n\n${usmleStyle}\n\n`;
        }
        if (explanationQuality) {
            qualitySection += `## Explanation Quality Review\n\n${explanationQuality}\n\n`;
        }
        if (originality) {
            qualitySection += `## Originality Review\n\n${originality}\n\n`;
        }
        if (grammar) {
            qualitySection += `## Grammar Review\n\n${grammar}\n\n`;
        }
        if (vignetteReview) {
            qualitySection += `## Vignette Review\n\n${vignetteReview}\n\n`;
        }
        if (qualitySection) {
            mdContent += `## Quality Reviews\n\n${qualitySection}`;
        }

        // Footer
        mdContent += `---\n\n*Imported from Excel row ${index + 2}*\n\n`;
        mdContent += `<!-- METADATA: Source=Excel, Row=${index + 2}, Topic=${topic}, QID=${qid} -->`;

        // Create filename from topic and index
        const filename = topic
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_|_$/g, '') || `row_${index + 2}`;

        const filePath = path.join(outputDir, `${String(index + 1).padStart(3, '0')}_${filename}.md`);

        // Write to file
        fs.writeFileSync(filePath, mdContent.trim(), 'utf-8');
        successCount++;
        console.log(`✅ Row ${index + 2}: Created ${path.basename(filePath)}`);

    } catch (error) {
        errorCount++;
        console.error(`❌ Row ${index + 2}: Error - ${error.message}`);
    }
});

// Summary
console.log(`\n${'='.repeat(50)}`);
console.log(`📁 Files saved to: ${outputDir}`);
console.log(`✅ Successfully created: ${successCount} .md files`);
console.log(`❌ Failed: ${errorCount} files`);
console.log(`${'='.repeat(50)}`);