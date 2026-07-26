import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject } from 'class-validator';

export class UploadDocumentDto {


    @ApiProperty()
    @IsString()
    title!: string;

    @ApiProperty()
    @IsString()
    content!: string;

    @ApiProperty()
    @IsOptional()
    @IsString()
    source?: string;

    @ApiProperty()
    @IsOptional()
    @IsObject()
    metadata?: Record<string, any>;
}