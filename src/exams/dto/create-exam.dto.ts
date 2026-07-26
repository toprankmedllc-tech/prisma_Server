import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateExamDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty()
  @IsNumber()
  durationMin!: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;
}
