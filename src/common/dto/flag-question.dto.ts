import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class FlagQuestionDto {
  @ApiProperty({ example: true, description: 'Whether the student has flagged the question' })
  @IsBoolean()
  isFlagged: boolean;
}
