import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class AddQuestionsDto {
  @ApiProperty({
    type: [String],
    description: 'Array of question IDs to add to the exam',
  })
  @IsArray()
  @IsString({ each: true })
  questionIds!: string[];
}
