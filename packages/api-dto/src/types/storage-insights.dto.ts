import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsArray,
    IsNumber,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';

/** Bytes and number of files of existing (not deleted) files */
export class StorageAmountDto {
    @ApiProperty()
    @IsNumber()
    bytes!: number;

    @ApiProperty()
    @IsNumber()
    fileCount!: number;
}

export class StorageTotalsDto extends StorageAmountDto {
    @ApiProperty({ description: 'Projects that contain at least one file' })
    @IsNumber()
    projectCount!: number;
}

export class StorageMonthDto {
    @ApiProperty({ description: 'Calendar month, YYYY-MM' })
    @IsString()
    month!: string;

    @ApiProperty({
        description:
            'Bytes stored at the end of the month (the current month: now)',
    })
    @IsNumber()
    bytes!: number;
}

export class StorageProjectDto {
    @ApiProperty()
    @IsString()
    uuid!: string;

    @ApiProperty()
    @IsString()
    name!: string;

    @ApiProperty()
    @IsNumber()
    bytes!: number;

    @ApiProperty()
    @IsNumber()
    missionCount!: number;
}

export class StorageOtherProjectsDto {
    @ApiProperty()
    @IsNumber()
    bytes!: number;

    @ApiProperty()
    @IsNumber()
    projectCount!: number;
}

export class StorageTypeDto extends StorageAmountDto {
    @ApiProperty({
        description: 'File type, or "OTHER" for the folded small types',
    })
    @IsString()
    type!: string;

    @ApiProperty({
        type: [String],
        description: 'For "OTHER": the file types it contains',
    })
    @IsArray()
    @IsString({ each: true })
    types!: string[];
}

export class StorageMissionDto {
    @ApiProperty()
    @IsString()
    missionUuid!: string;

    @ApiProperty()
    @IsString()
    missionName!: string;

    @ApiProperty()
    @IsString()
    projectUuid!: string;

    @ApiProperty()
    @IsString()
    projectName!: string;

    @ApiProperty()
    @IsNumber()
    bytes!: number;
}

/** Where the stored data comes from and how it grows */
export class StorageInsightsDto {
    @ApiProperty({ type: () => StorageTotalsDto })
    @ValidateNested()
    @Type(() => StorageTotalsDto)
    totals!: StorageTotalsDto;

    @ApiProperty({ type: () => StorageAmountDto })
    @ValidateNested()
    @Type(() => StorageAmountDto)
    last30Days!: StorageAmountDto;

    @ApiProperty({ type: () => StorageAmountDto })
    @ValidateNested()
    @Type(() => StorageAmountDto)
    last90Days!: StorageAmountDto;

    @ApiProperty({
        type: () => [StorageMonthDto],
        description: 'The last 12 calendar months, oldest first',
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => StorageMonthDto)
    monthly!: StorageMonthDto[];

    @ApiProperty({
        type: () => [StorageProjectDto],
        description: 'The 6 largest projects',
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => StorageProjectDto)
    byProject!: StorageProjectDto[];

    @ApiProperty({
        type: () => StorageOtherProjectsDto,
        nullable: true,
        description: 'All other projects together, null if there are none',
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => StorageOtherProjectsDto)
    otherProjects!: StorageOtherProjectsDto | null;

    @ApiProperty({ type: () => [StorageTypeDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => StorageTypeDto)
    byType!: StorageTypeDto[];

    @ApiProperty({ type: () => [StorageMissionDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => StorageMissionDto)
    largestMissions!: StorageMissionDto[];
}
