import { IsString, IsOptional, IsBoolean, IsObject, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewActionDto {
    @ApiProperty({ enum: ['review', 'skip'], description: 'Action to perform: review the question or skip it' })
    @IsString()
    @IsIn(['review', 'skip'])
    action!: string;

    @ApiPropertyOptional({ description: 'Set true to reject the question. If approved, set to false.' })
    @IsOptional()
    @IsBoolean()
    rejected?: boolean;

    @ApiPropertyOptional({ description: 'User ID of the reviewer (for audit trail)' })
    @IsOptional()
    @IsString()
    reviewedBy?: string;

    @ApiPropertyOptional({
        description: 'Attribute-level review notes. Keys can be any question field (stem, leadInQuestion, explanation, choices, correctAnswer, etc.)',
        example: {
            stem: 'The stem is well-written.',
            choices: { 'choice-id-1': 'This distracter is too obvious.' },
            explanation: 'Needs more detail about the mechanism.',
            generalNotes: 'Overall good question, minor fixes needed.',
        },
    })
    @IsOptional()
    @IsObject()
    reviewNotes?: Record<string, any>;
}