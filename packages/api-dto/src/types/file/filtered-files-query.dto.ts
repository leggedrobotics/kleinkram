import { HealthStatus } from '@kleinkram/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsDate,
    IsEnum,
    IsInt,
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    Min,
} from 'class-validator';

export class FilteredFilesQueryDto {
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
    @IsObject()
    @ApiProperty({
        required: false,
        description: 'Dictionary Tagtype name to Tag value',
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tags?: Record<string, any>;

    @IsOptional()
    @IsInt()
    @Min(0)
    @Type(() => Number)
    @ApiProperty({ required: false, default: 0 })
    skip = 0;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(10_000)
    @Type(() => Number)
    @ApiProperty({ required: false, default: 100 })
    take = 100;

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false, default: 'createdAt' })
    sort = 'createdAt';

    @IsOptional()
    @IsEnum(['ASC', 'DESC'])
    @ApiProperty({ required: false, enum: ['ASC', 'DESC'], default: 'ASC' })
    sortDirection: 'ASC' | 'DESC' = 'ASC';

    @IsOptional()
    @IsEnum(HealthStatus)
    @ApiProperty({
        required: false,
        enum: HealthStatus,
        description: 'File health',
    })
    health?: HealthStatus;
}
