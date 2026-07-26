import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Difficulty } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ExamType {
    USMLE_STEP_1 = 'USMLE_STEP_1',
    USMLE_STEP_2_CK = 'USMLE_STEP_2_CK',
    USMLE_STEP_3 = 'USMLE_STEP_3',
}

export class GenerateQuestionsDto {
    @ApiProperty()
    @IsString()
    topic!: string;

    @ApiProperty()
    @IsEnum(Difficulty)
    difficulty!: Difficulty;

    @ApiProperty()
    @IsEnum(ExamType)
    examType!: ExamType;

    @ApiProperty()
    @IsInt()
    @Min(1)
    @Max(10)
    count!: number;
}


export class ImportQuestionsDto {
    @ApiProperty({ type: 'string', format: 'binary' })
    file: any;

    @ApiPropertyOptional({ enum: ['BUZZWORD', 'VIGNETTE'] })
    @IsOptional()
    @IsString()
    sourceType?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    sourceFile?: string;
}


export class FindAllQuestionsDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    topic?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    topicId?: string;

    @ApiPropertyOptional({ enum: ['EASY', 'MEDIUM', 'HARD'] })
    @IsOptional()
    @IsString()
    difficulty?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    source?: string;

    @ApiPropertyOptional({ enum: ['BUZZWORD', 'VIGNETTE'] })
    @IsOptional()
    @IsString()
    sourceType?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    system?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    discipline?: string;

    @ApiPropertyOptional({ enum: ['RECALL', 'APPLICATION', 'CLINICAL_REASONING', 'ANALYSIS'] })
    @IsOptional()
    @IsString()
    cognitiveLevel?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    trapType?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    tag?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    isPublished?: boolean;

    @ApiPropertyOptional({ example: 0 })
    @IsOptional()
    @IsNumber()
    skip?: number;

    @ApiPropertyOptional({ example: 50 })
    @IsOptional()
    @IsNumber()
    take?: number;

    @ApiPropertyOptional({ enum: ['createdAt', 'difficulty', 'sourceType', 'topic'] })
    @IsOptional()
    @IsString()
    sortBy?: string;

    @ApiPropertyOptional({ enum: ['asc', 'desc'] })
    @IsOptional()
    @IsString()
    sortOrder?: 'asc' | 'desc';
}
function Type(arg0: () => NumberConstructor): (target: FindAllQuestionsDto, propertyKey: "take") => void {
    throw new Error('Function not implemented.');
}

