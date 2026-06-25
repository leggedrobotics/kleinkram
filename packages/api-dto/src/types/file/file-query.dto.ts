import { MissionQueryDto } from '@api-dto/mission/mission-query.dto';
import { HealthStatus } from '@kleinkram/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
    ArrayNotEmpty,
    IsArray,
    IsBoolean,
    IsDate,
    IsEnum,
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';

export class FileQueryDto extends MissionQueryDto {
    @IsOptional()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayNotEmpty()
    @IsUUID('4', { each: true })
    @ApiProperty({ required: false })
    fileUuids?: string[];

    @IsOptional()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    @ApiProperty({ required: false })
    filePatterns?: string[];

    @IsOptional()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    @ApiProperty({ required: false })
    fileExtensions?: string[];

    @IsOptional()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    @ApiProperty({ required: false })
    topicPatterns?: string[];

    @IsOptional()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    @ApiProperty({ required: false })
    categoryPatterns?: string[];

    // Filters consolidated from FilteredFilesQueryDto
    @IsOptional()
    @IsString()
    @ApiProperty({ required: false, description: 'Filter for Filename' })
    fileName?: string;

    @IsOptional()
    @IsUUID('4')
    @ApiProperty({
        required: false,
        description: 'UUID of Project to filter by',
    })
    projectUUID?: string;

    @IsOptional()
    @IsUUID('4')
    @ApiProperty({
        required: false,
        description: 'UUID of Mission to filter by',
    })
    missionUUID?: string;

    @IsOptional()
    @IsDate()
    @Type(() => Date)
    @ApiProperty({
        required: false,
        description: 'Date specifying the start of the filtered time range',
    })
    startDate?: Date;

    @IsOptional()
    @IsDate()
    @Type(() => Date)
    @ApiProperty({
        required: false,
        description: 'Date specifying the end of the filtered time range',
    })
    endDate?: Date;

    @IsOptional()
    @IsString()
    @ApiProperty({
        required: false,
        description: 'Name of Topics (coma separated)',
    })
    topics?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({
        required: false,
        description: 'Message datatypes to filter by (coma separated)',
    })
    messageDatatypes?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({
        required: false,
        description: 'File types to filter by (coma separated)',
    })
    fileTypes?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({
        required: false,
        description: 'Categories to filter by (coma separated)',
    })
    categories?: string;

    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    @ApiProperty({
        required: false,
        description:
            'Returned File needs all specified topics (true) or any specified topics (false)',
    })
    matchAllTopics = false;

    @IsOptional()
    @Transform(({ value }) => {
        if (typeof value === 'string') {
            try {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                return JSON.parse(value);
            } catch {
                return value;
            }
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return value;
    })
    @IsObject()
    @ApiProperty({
        required: false,
        description: 'Dictionary Tagtype name to Tag value',
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tags?: Record<string, any>;

    @IsOptional()
    @IsEnum(HealthStatus)
    @ApiProperty({
        required: false,
        enum: HealthStatus,
        description: 'File health',
    })
    health?: HealthStatus;

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    sort?: string;
}
