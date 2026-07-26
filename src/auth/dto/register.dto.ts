import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export enum StudentType {
  MEDICAL_GRADUATE = 'MEDICAL_GRADUATE',
  GRADUATE = 'GRADUATE',
  INTERMEDIATE_GRADUATE_IMG = 'INTERMEDIATE_GRADUATE_IMG',
}

export enum TargetExam {
  USMLE_STEP_1 = 'USMLE_STEP_1',
  USMLE_STEP_2_CK = 'USMLE_STEP_2_CK',
  USMLE_STEP_3 = 'USMLE_STEP_3',
}

export class RegisterDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty()
  @IsString()
  firstName!: string;

  @ApiProperty()
  @IsString()
  lastName!: string;

  @ApiProperty({ enum: StudentType, description: 'Student type: Medical Graduate, Graduate, or Intermediate Graduate IMG' })
  @IsEnum(StudentType)
  studentType!: StudentType;

  @ApiProperty({ enum: TargetExam, description: 'Target exam: USMLE Step 1, Step 2 CK, or Step 3' })
  @IsEnum(TargetExam)
  targetExam!: TargetExam;

  @ApiPropertyOptional({ description: 'Target test date (optional)' })
  @IsOptional()
  @IsDateString()
  targetTestDate?: string;

  @ApiProperty({ description: 'Accept terms and conditions' })
  @IsBoolean()
  acceptedTerms!: boolean;

  @ApiProperty({ description: 'Accept privacy policy' })
  @IsBoolean()
  acceptedPrivacy!: boolean;
}