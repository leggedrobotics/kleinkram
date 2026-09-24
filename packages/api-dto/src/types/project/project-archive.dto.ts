import { ProjectArchiveJobState, ProjectArchiveState } from '@kleinkram/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsDate,
    IsEnum,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    MinLength,
    ValidateNested,
} from 'class-validator';

export class ArchivePartDto {
    @ApiProperty()
    @IsString()
    @Expose()
    name!: string;

    @ApiProperty()
    @IsNumber()
    @Expose()
    size!: number;

    @ApiProperty()
    @IsString()
    @Expose()
    sha256!: string;

    @ApiProperty()
    @IsNumber()
    @Expose()
    fileCount!: number;
}

export class ProjectArchiveDto {
    @ApiProperty()
    @IsUUID()
    @Expose()
    uuid!: string;

    @ApiProperty({ enum: ProjectArchiveJobState })
    @IsEnum(ProjectArchiveJobState)
    @Expose()
    state!: ProjectArchiveJobState;

    @ApiProperty({ description: 'Directory on the archive storage' })
    @IsString()
    @Expose()
    location!: string;

    @ApiProperty({ type: [ArchivePartDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ArchivePartDto)
    @Expose()
    parts!: ArchivePartDto[];

    @ApiProperty()
    @IsNumber()
    @Expose()
    fileCount!: number;

    @ApiProperty()
    @IsNumber()
    @Expose()
    totalBytes!: number;

    @ApiProperty()
    @IsNumber()
    @Expose()
    bytesProcessed!: number;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsString()
    @Expose()
    reason!: string | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsString()
    @Expose()
    requestedBy!: string | null;

    @ApiProperty()
    @IsDate()
    @Expose()
    createdAt!: Date;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsDate()
    @Expose()
    archivedAt!: Date | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsString()
    @Expose()
    restoreReason!: string | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsString()
    @Expose()
    restoreRequestedBy!: string | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsDate()
    @Expose()
    restoreRequestedAt!: Date | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsDate()
    @Expose()
    restoredAt!: Date | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsString()
    @Expose()
    error!: string | null;

    @ApiProperty({
        description:
            'Failed or interrupted runs of the current phase; it is retried ' +
            'automatically until maxAttempts',
    })
    @IsNumber()
    @Expose()
    attempts!: number;

    @ApiProperty()
    @IsNumber()
    @Expose()
    maxAttempts!: number;
}

/** What archiving the project right now would involve. */
export class ArchivePreflightDto {
    @ApiProperty()
    @IsNumber()
    @Expose()
    missionCount!: number;

    @ApiProperty()
    @IsNumber()
    @Expose()
    fileCount!: number;

    @ApiProperty()
    @IsNumber()
    @Expose()
    totalBytes!: number;

    @ApiProperty({ description: 'Number of tar parts that would be written' })
    @IsNumber()
    @Expose()
    estimatedParts!: number;

    @ApiProperty({
        required: false,
        nullable: true,
        description:
            'Yearly cost on the archive storage, in the currency of the ' +
            'storage; null if no price is configured',
    })
    @IsOptional()
    @IsNumber()
    @Expose()
    estimatedYearlyCost!: number | null;

    @ApiProperty({
        description:
            'Whether the files are identical to the last restored archive, ' +
            'which is then reused instead of writing a new copy',
    })
    @IsBoolean()
    @Expose()
    reusesPreviousArchive!: boolean;

    @ApiProperty({
        type: [String],
        description: 'Reasons that currently prevent archiving',
    })
    @IsArray()
    @IsString({ each: true })
    @Expose()
    blockers!: string[];
}

export class ArchiveStorageLinkDto {
    @ApiProperty()
    @IsString()
    @Expose()
    label!: string;

    @ApiProperty()
    @IsString()
    @Expose()
    url!: string;
}

/** The archive storage this instance writes to, as configured. */
export class ArchiveStorageInfoDto {
    @ApiProperty({
        description:
            'Whether this instance can archive and restore projects ' +
            '(ARCHIVE_ENABLED)',
    })
    @IsBoolean()
    @Expose()
    enabled!: boolean;

    @ApiProperty({ description: 'Name shown to users, e.g. ETH LTS' })
    @IsString()
    @Expose()
    name!: string;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsString()
    @Expose()
    description!: string | null;

    @ApiProperty({ type: [ArchiveStorageLinkDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ArchiveStorageLinkDto)
    @Expose()
    links!: ArchiveStorageLinkDto[];

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsNumber()
    @Expose()
    costPerTbYear!: number | null;

    @ApiProperty()
    @IsString()
    @Expose()
    currency!: string;
}

export class ProjectArchiveStatusDto {
    @ApiProperty({ type: ArchiveStorageInfoDto })
    @ValidateNested()
    @Type(() => ArchiveStorageInfoDto)
    @Expose()
    storage!: ArchiveStorageInfoDto;

    @ApiProperty({ enum: ProjectArchiveState })
    @IsEnum(ProjectArchiveState)
    @Expose()
    archiveState!: ProjectArchiveState;

    @ApiProperty({ type: ProjectArchiveDto, required: false, nullable: true })
    @IsOptional()
    @ValidateNested()
    @Type(() => ProjectArchiveDto)
    @Expose()
    current!: ProjectArchiveDto | null;

    @ApiProperty({ type: [ProjectArchiveDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ProjectArchiveDto)
    @Expose()
    history!: ProjectArchiveDto[];

    @ApiProperty({
        required: false,
        nullable: true,
        description:
            'How to get the files of the current archive back without ' +
            'Kleinkram, from the deployment config',
    })
    @IsOptional()
    @IsString()
    @Expose()
    restoreInstructions!: string | null;

    @ApiProperty({ type: ArchivePreflightDto, required: false, nullable: true })
    @IsOptional()
    @ValidateNested()
    @Type(() => ArchivePreflightDto)
    @Expose()
    preflight!: ArchivePreflightDto | null;
}

export class ArchiveProjectDto {
    @ApiProperty({
        required: false,
        description: 'Why the project is archived, shown in its history',
    })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    reason?: string;
}

export class RestoreProjectDto {
    @ApiProperty({
        description:
            'Why the data is needed again. Recalls from cold storage are ' +
            'slow and may cost extra, so every restore is justified.',
    })
    @IsString()
    @MinLength(3)
    @MaxLength(2000)
    reason!: string;
}
