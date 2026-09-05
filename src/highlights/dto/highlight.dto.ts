import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateHighlightDto {
  @ApiProperty({ example: 'stem', description: 'Which text root the highlight belongs to: stem, leadInQuestion, explanation, or choice-<index>' })
  @IsString()
  textRoot!: string;

  @ApiProperty({ example: 12, description: 'Start offset (in characters) within the normalized text root' })
  @IsInt()
  @Min(0)
  start!: number;

  @ApiProperty({ example: 34, description: 'End offset (exclusive) within the normalized text root' })
  @IsInt()
  @Min(0)
  end!: number;

  @ApiProperty({ example: 'acute coronary syndrome', description: 'The highlighted text content' })
  @IsString()
  @MaxLength(2000)
  text!: string;

  @ApiPropertyOptional({ example: 'yellow', description: 'Highlight color (yellow, green, blue, pink, purple)' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: 'Key buzzword to remember', description: 'Optional study note attached to the highlight' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class UpdateHighlightDto {
  @ApiPropertyOptional({ example: 'yellow', description: 'Highlight color (yellow, green, blue, pink, purple)' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: 'Updated study note', description: 'Optional study note attached to the highlight' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}