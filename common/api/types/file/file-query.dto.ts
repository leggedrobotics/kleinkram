import { MissionQueryDto } from '../mission/mission-query.dto';
import {
    IsArray,
    IsOptional,
    IsString,
    IsUUID,
    ArrayNotEmpty,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class FileQueryDto extends MissionQueryDto {
    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayNotEmpty()
    @IsUUID('4', { each: true })
    @ApiProperty({ required: false })
    fileUuids?: string[];

    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    @ApiProperty({ required: false })
    filePatterns?: string[];

    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    @ApiProperty({ required: false })
    fileExtensions?: string[];

    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    @ApiProperty({ required: false })
    topicPatterns?: string[];

    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    @ApiProperty({ required: false })
    categoryPatterns?: string[];
}
