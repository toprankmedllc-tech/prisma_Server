const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Get the Excel file from command line
const excelFile = process.argv[2];
if (!excelFile) {
    console.error('❌ Please provide the Excel file path:');
    console.error('   node index.js buzzword_questions.xlsx');
    process.exit(1);
}

// Check if file exists in current directory
const excelPath = path.join(__dirname, excelFile);
if (!fs.existsSync(excelPath)) {
    console.error(`❌ File not found: ${excelPath}`);
    process.exit(1);
}

// Create output directory for markdown files
const outputDir = path.join(__dirname, 'output_buzzword_markdown');
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
let emptyCount = 0;

rows.forEach((row, index) => {
    try {
        // Extract data with EXACT column names from your Excel
        const system = row['System'] || '';
        const discipline = row['Discipline '] || '';
        const topic = row['Target Diagnosis'] || 'Unknown Topic';
        const buzzwordQuestion = row['Full Buzzword question '] || '';
        const buzzwords = row['Buzzwords Used in question (Separate by ;)'] || '';
        const options = row['Options A-D\n\nCopy this format:\n\nA)\nB)\nC)\nD)'] || '';
        const correctAnswer = row['Correct Answer'] || '';
        const correctExplanation = row['Correct Answer Explanation (Should be brief 1-3 sentences) '] || '';
        const correctBuzzwordCombo = row['Buzzword Combo Correct Option (A+B+C= D) '] || '';
        const wrongOption1 = row['Wrong option 1'] || '';
        const wrongOption1Explanation = row['Wrong option 1 Explanation (1-2 sentences) '] || '';
        const wrongOption1BuzzwordCombo = row['Buzzword Combo Wrong Option 1 (A+B+C= D) '] || '';
        const wrongOption2 = row['Wrong option 2'] || '';
        const wrongOption2Explanation = row['Wrong option 2 Explanation (1-2 sentences) '] || '';
        const wrongOption2BuzzwordCombo = row['Buzzword Combo Wrong Option 2 (A+B+C= D) '] || '';
        const wrongOption3 = row['Wrong option 3'] || '';
        const wrongOption3Explanation = row['Wrong option 3 Explanation (1-2 sentences) (A+B+C= D) '] || '';
        const wrongOption3BuzzwordCombo = row['Buzzword Combo Wrong Option 3 (A+B+C= D) '] || '';
        const tags = row['Tags / Keywords (Refer to the keyword document provided to you) '] || '';
        const cognitiveLevel = row['Cognitive Level'] || '';
        const difficulty = row['Question Difficulty '] || '';
        const trapType = row['Trap Type '] || '';
        const relatedConcepts = row['3 Suggested Related Concepts (Separate by ; )\n(Example question was about Aortic Dissection, and the suggested concepts were Myocardial Infarction; Pericarditis; Pulmonary Embolism) '] || '';

        // Check if row has actual content
        const hasContent = buzzwordQuestion || options || correctAnswer || topic !== 'Unknown Topic';

        if (!hasContent) {
            emptyCount++;
            console.log(`⚠️  Row ${index + 2}: Empty row (skipping)`);
            return;
        }

        // Build the markdown content
        let mdContent = `# ${topic}\n\n`;

        // Add metadata section
        mdContent += `## Metadata\n\n`;
        mdContent += `| Field | Value |\n`;
        mdContent += `|-------|-------|\n`;
        mdContent += `| System | ${system || 'N/A'} |\n`;
        mdContent += `| Discipline | ${discipline || 'N/A'} |\n`;
        mdContent += `| Difficulty | ${difficulty || 'N/A'} |\n`;
        mdContent += `| Cognitive Level | ${cognitiveLevel || 'N/A'} |\n`;
        mdContent += `| Trap Type | ${trapType || 'N/A'} |\n`;
        mdContent += `| Question Type | Buzzword |\n\n`;

        // Buzzword question
        if (buzzwordQuestion) {
            mdContent += `## Buzzword Question\n\n${buzzwordQuestion}\n\n`;
        }

        // Buzzwords used
        if (buzzwords) {
            mdContent += `## Buzzwords Used\n\n${buzzwords}\n\n`;
        }

        // Answer Options
        if (options) {
            mdContent += `## Answer Options\n\n${options}\n\n`;
        }

        // Correct Answer
        if (correctAnswer) {
            mdContent += `## Correct Answer\n\n${correctAnswer}\n\n`;
        }

        // Correct Answer Explanation
        if (correctExplanation) {
            mdContent += `## Explanation\n\n${correctExplanation}\n\n`;
        }

        // Buzzword Combo for Correct Answer
        if (correctBuzzwordCombo) {
            mdContent += `## Buzzword Combination (Correct)\n\n${correctBuzzwordCombo}\n\n`;
        }

        // Wrong Options
        let wrongSection = '';
        if (wrongOption1) {
            wrongSection += `## Wrong Options\n\n`;
            wrongSection += `### ${wrongOption1}\n\n`;
            if (wrongOption1Explanation) {
                wrongSection += `${wrongOption1Explanation}\n\n`;
            }
            if (wrongOption1BuzzwordCombo) {
                wrongSection += `**Buzzword Combo:** ${wrongOption1BuzzwordCombo}\n\n`;
            }
        }
        if (wrongOption2) {
            if (!wrongSection) {
                wrongSection += `## Wrong Options\n\n`;
            }
            wrongSection += `### ${wrongOption2}\n\n`;
            if (wrongOption2Explanation) {
                wrongSection += `${wrongOption2Explanation}\n\n`;
            }
            if (wrongOption2BuzzwordCombo) {
                wrongSection += `**Buzzword Combo:** ${wrongOption2BuzzwordCombo}\n\n`;
            }
        }
        if (wrongOption3) {
            if (!wrongSection) {
                wrongSection += `## Wrong Options\n\n`;
            }
            wrongSection += `### ${wrongOption3}\n\n`;
            if (wrongOption3Explanation) {
                wrongSection += `${wrongOption3Explanation}\n\n`;
            }
            if (wrongOption3BuzzwordCombo) {
                wrongSection += `**Buzzword Combo:** ${wrongOption3BuzzwordCombo}\n\n`;
            }
        }
        if (wrongSection) {
            mdContent += wrongSection;
        }

        // Related Concepts
        if (relatedConcepts) {
            mdContent += `## Related Concepts\n\n${relatedConcepts}\n\n`;
        }

        // Tags
        if (tags) {
            mdContent += `## Tags\n\n${tags}\n\n`;
        }

        // Footer
        mdContent += `---\n\n*Imported from Excel row ${index + 2}*\n\n`;
        mdContent += `<!-- METADATA: Source=Excel, Row=${index + 2}, Topic=${topic}, Type=Buzzword -->`;

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
console.log(`⚠️  Empty rows skipped: ${emptyCount}`);
console.log(`❌ Failed: ${errorCount} files`);
console.log(`${'='.repeat(50)}`);