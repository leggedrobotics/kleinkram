import { MissionQueryDto } from '../mission/mission-query.dto';
import { IsArray, IsOptional, IsString, IsUUID, ArrayNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export class FileQueryDto extends MissionQueryDto {
    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayNotEmpty()
    @IsUUID('4', { each: true })
    fileUuids?: string[];

    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    filePatterns?: string[];


    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    fileExtensions?: string[];


    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    topicPatterns?: string[];


    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    categoryPatterns?: string[];
}

