import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, IsEnum } from 'class-validator';
import { DisplayStyle } from '@prisma/client';

export class UpdateProfileDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @ApiProperty({ required: false, enum: DisplayStyle })
  @IsOptional()
  @IsEnum(DisplayStyle)
  displayStyle?: DisplayStyle;
}