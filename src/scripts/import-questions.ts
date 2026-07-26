/**
 * Import Questions from JSON Data Files into Database
 * =====================================================
 *
 * This script reads question JSON files from:
 *   - data/output_json_buzzwords/questions.json (BUZZWORD type)
 *   - data/output_json_vignettes/vignette.json (VIGNETTE type)
 *
 * and imports them into the PostgreSQL database using the QuestionsService.
 *
 * Usage:
 *   npm run import:questions
 *
 * The script will:
 *   - Read all questions from both JSON files
 *   - Import them into the database via the existing QuestionsService
 *   - Report detailed import statistics
 */

import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { QuestionsService } from '../questions/questions.service';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// Configuration
// ============================================

const BUZZWORD_JSON_PATH = path.resolve(__dirname, '../../data/output_json_buzzwords/questions.json');
const VIGNETTE_JSON_PATH = path.resolve(__dirname, '../../data/output_json_vignettes/vignette.json');

const logger = new Logger('ImportQuestions');

// ============================================
// Types
// ============================================

interface ImportResult {
    sourceType: 'BUZZWORD' | 'VIGNETTE';
    sourceFile: string;
    total: number;
    imported: number;
    failed: number;
    errors: string[];
}

// ============================================
// File Reading
// ============================================

function readJsonFile(filePath: string): any[] | null {
    if (!fs.existsSync(filePath)) {
        logger.warn(`File not found: ${filePath}`);
        return null;
    }

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);

        if (!Array.isArray(data)) {
            logger.error(`File ${filePath} does not contain a JSON array`);
            return null;
        }

        if (data.length === 0) {
            logger.warn(`File ${filePath} contains an empty array`);
            return null;
        }

        return data;
    } catch (error: any) {
        logger.error(`Failed to parse ${filePath}: ${error.message}`);
        return null;
    }
}

// ============================================
// Main
// ============================================

async function main() {
    logger.log('============================================');
    logger.log('  Question Import Pipeline (JSON → DB)');
    logger.log('============================================');
    logger.log('');

    // 1. Create a NestJS application context (for DI)
    const app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    });

    const questionsService = app.get(QuestionsService);

    // 2. Check database connection (quick health check)
    try {
        const count = await questionsService.getQuestionStats();
        logger.log(`Database connected. Current question count: ${count.total}`);
    } catch (error: any) {
        logger.error(`Failed to connect to database: ${error.message}`);
        logger.error('Make sure DATABASE_URL is set correctly in .env');
        await app.close();
        process.exit(1);
    }

    // ============================================
    // 3. Import Buzzword Questions
    // ============================================
    logger.log('');
    logger.log('--- Processing Buzzword Questions ---');
    logger.log(`  Source: ${BUZZWORD_JSON_PATH}`);

    const buzzwordQuestions = readJsonFile(BUZZWORD_JSON_PATH);
    const buzzwordResult: ImportResult = {
        sourceType: 'BUZZWORD',
        sourceFile: 'buzzword_questions.json',
        total: 0,
        imported: 0,
        failed: 0,
        errors: [],
    };

    if (buzzwordQuestions) {
        buzzwordResult.total = buzzwordQuestions.length;
        logger.log(`  Found ${buzzwordQuestions.length} buzzword questions to import`);

        const result = await questionsService.importQuestions(
            buzzwordQuestions,
            'BUZZWORD',
            'buzzword_questions.json',
        );

        buzzwordResult.imported = result.imported;
        buzzwordResult.failed = result.failed;
        buzzwordResult.errors = result.errors;
    }

    // ============================================
    // 4. Import Vignette Questions
    // ============================================
    logger.log('');
    logger.log('--- Processing Vignette Questions ---');
    logger.log(`  Source: ${VIGNETTE_JSON_PATH}`);

    const vignetteQuestions = readJsonFile(VIGNETTE_JSON_PATH);
    const vignetteResult: ImportResult = {
        sourceType: 'VIGNETTE',
        sourceFile: 'vignette_questions.json',
        total: 0,
        imported: 0,
        failed: 0,
        errors: [],
    };

    if (vignetteQuestions) {
        vignetteResult.total = vignetteQuestions.length;
        logger.log(`  Found ${vignetteQuestions.length} vignette questions to import`);

        const result = await questionsService.importQuestions(
            vignetteQuestions,
            'VIGNETTE',
            'vignette_questions.json',
        );

        vignetteResult.imported = result.imported;
        vignetteResult.failed = result.failed;
        vignetteResult.errors = result.errors;
    }

    // ============================================
    // 5. Summary
    // ============================================
    const totalFound = buzzwordResult.total + vignetteResult.total;
    const totalImported = buzzwordResult.imported + vignetteResult.imported;
    const totalFailed = buzzwordResult.failed + vignetteResult.failed;

    logger.log('');
    logger.log('============================================');
    logger.log('  IMPORT COMPLETE');
    logger.log('============================================');
    logger.log('');
    logger.log(`  BUZZWORD Questions:`);
    logger.log(`    - Found:    ${buzzwordResult.total}`);
    logger.log(`    - Imported: ${buzzwordResult.imported}`);
    logger.log(`    - Failed:   ${buzzwordResult.failed}`);
    if (buzzwordResult.errors.length > 0) {
        logger.warn(`    - Errors (first 5):`);
        buzzwordResult.errors.slice(0, 5).forEach((err, i) => {
            logger.warn(`        ${i + 1}. ${err}`);
        });
        if (buzzwordResult.errors.length > 5) {
            logger.warn(`        ... and ${buzzwordResult.errors.length - 5} more`);
        }
    }
    logger.log('');
    logger.log(`  VIGNETTE Questions:`);
    logger.log(`    - Found:    ${vignetteResult.total}`);
    logger.log(`    - Imported: ${vignetteResult.imported}`);
    logger.log(`    - Failed:   ${vignetteResult.failed}`);
    if (vignetteResult.errors.length > 0) {
        logger.warn(`    - Errors (first 5):`);
        vignetteResult.errors.slice(0, 5).forEach((err, i) => {
            logger.warn(`        ${i + 1}. ${err}`);
        });
        if (vignetteResult.errors.length > 5) {
            logger.warn(`        ... and ${vignetteResult.errors.length - 5} more`);
        }
    }
    logger.log('');
    logger.log(`  TOTAL:`);
    logger.log(`    - Found:    ${totalFound}`);
    logger.log(`    - Imported: ${totalImported}`);
    logger.log(`    - Failed:   ${totalFailed}`);
    logger.log('');

    // Verify
    try {
        const stats = await questionsService.getQuestionStats();
        logger.log(`  Database now has ${stats.total} total questions`);
        logger.log(`    - Buzzword: ${stats.bySourceType.BUZZWORD}`);
        logger.log(`    - Vignette: ${stats.bySourceType.VIGNETTE}`);
        logger.log(`    - Published: ${stats.published}`);
        logger.log(`    - Unpublished: ${stats.unpublished}`);
    } catch (error: any) {
        logger.warn(`  Could not verify final count: ${error.message}`);
    }

    logger.log('');
    logger.log('Done!');

    await app.close();
}

main().catch((error) => {
    logger.error(`Fatal error: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
});