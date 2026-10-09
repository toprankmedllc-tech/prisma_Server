import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export enum PlanInterval {
  MONTH = 'MONTH',
  YEAR = 'YEAR',
}

export class PlanFeatureDto {
  @ApiProperty({ description: 'Feature label shown on the pricing card' })
  @IsString()
  @MinLength(1)
  label!: string;
}

export class CreatePlanDto {
  @ApiProperty({ description: 'Plan display name, e.g. Pro' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({
    description: 'URL-friendly unique slug. Auto-generated from name when omitted.',
  })
  @IsOptional()
  @IsString()
  @Length(2, 60)
  slug?: string;

  @ApiPropertyOptional({ description: 'Short marketing description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Price in the smallest currency unit (e.g. cents). 4900 = $49.00',
  })
  @IsInt()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({ description: 'ISO currency code', default: 'usd' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ enum: PlanInterval, default: PlanInterval.MONTH })
  @IsOptional()
  @IsEnum(PlanInterval)
  interval?: PlanInterval;

  @ApiPropertyOptional({
    description: 'Percentage discount (0-100). Provide either percent or flat amount.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @ValidateIf((o) => !o.discountAmount)
  discountPercent?: number;

  @ApiPropertyOptional({
    description: 'Flat discount in the smallest currency unit.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @ValidateIf((o) => !o.discountPercent)
  discountAmount?: number;

  @ApiPropertyOptional({ description: 'Feature list shown on the pricing card' })
  @IsOptional()
  @IsArray()
  features?: PlanFeatureDto[];

  @ApiPropertyOptional({ description: 'Whether the plan is purchasable', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Mark the plan as "Most Popular"' })
  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;

  @ApiPropertyOptional({ description: 'Display ordering (lower shows first)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdatePlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ enum: PlanInterval })
  @IsOptional()
  @IsEnum(PlanInterval)
  interval?: PlanInterval;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  discountPercent?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  discountAmount?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  features?: PlanFeatureDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
