import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional } from 'class-validator';

export class UpdateExamDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  durationMin?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;
}
