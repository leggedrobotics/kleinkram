/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any */
import { CategoryDto } from '@api-dto/category.dto';
import { MissionDto } from '@api-dto/mission/mission.dto';
import { TopicDto } from '@api-dto/topic.dto';
import { UserDto } from '@api-dto/user/user.dto';
import { FileState, FileType } from '@kleinkram/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform, Type, plainToInstance } from 'class-transformer';
import {
    IsBoolean,
    IsDate,
    IsEnum,
    IsNumber,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';

const toDateOrNull = (value: unknown): Date | null => {
    if (value === null || value === undefined) return null;
    const date = value instanceof Date ? value : new Date(value as string);
    return Number.isNaN(date.getTime()) ? null : date;
};

const durationSeconds = (start: unknown, end: unknown): number | null => {
    const startDate = toDateOrNull(start);
    const endDate = toDateOrNull(end);
    if (!startDate || !endDate) return null;

    const seconds = (endDate.getTime() - startDate.getTime()) / 1000;
    return seconds >= 0 ? seconds : null;
};

@Expose()
export class FileDto {
    @ApiProperty()
    @IsString()
    @Expose()
    uuid!: string;

    @ApiProperty()
    @IsString()
    @Expose()
    filename!: string;

    /**
     * The date the file is sorted and filtered by: the recording start where
     * it is known, the upload time otherwise. Prefer `recordingStartDate` when
     * you need to tell the two apart.
     */
    @ApiProperty()
    @IsDate()
    @Expose()
    date!: Date;

    @ApiProperty({
        description:
            'Timestamp of the first message of the recording, null while unknown',
        nullable: true,
    })
    @IsDate()
    @IsOptional()
    @Expose()
    @Transform(({ obj }) => toDateOrNull(obj.recordingStartDate))
    recordingStartDate!: Date | null;

    @ApiProperty({
        description:
            'Timestamp of the last message of the recording, null while unknown',
        nullable: true,
    })
    @IsDate()
    @IsOptional()
    @Expose()
    @Transform(({ obj }) => toDateOrNull(obj.recordingEndDate))
    recordingEndDate!: Date | null;

    /**
     * Wall-clock length of the recording in seconds, derived from the
     * recording bounds. Null whenever either bound is unknown.
     */
    @ApiProperty({
        description:
            'Wall-clock length of the recording in seconds, null while unknown',
        nullable: true,
    })
    @IsNumber()
    @IsOptional()
    @Expose()
    @Transform(({ obj }) =>
        durationSeconds(obj.recordingStartDate, obj.recordingEndDate),
    )
    durationSeconds!: number | null;

    /**
     * The time the file was uploaded to Kleinkram.
     */
    @ApiProperty()
    @IsDate()
    @Expose()
    createdAt!: Date;

    @ApiProperty()
    @IsDate()
    @Expose()
    updatedAt!: Date;

    @ApiProperty({
        description: 'The mission the file belongs to',
        type: () => MissionDto,
    })
    @ValidateNested()
    @Type(() => MissionDto)
    @Expose()
    mission!: MissionDto;

    @ApiProperty({
        description: 'List of categories',
        type: () => [CategoryDto],
    })
    @ValidateNested()
    @Type(() => CategoryDto)
    @Expose()
    categories!: CategoryDto[];

    @ApiProperty()
    @IsNumber()
    @Expose()
    @Transform(({ value, obj }) => obj.size ?? value ?? 0)
    size!: number;

    @ApiProperty({
        description: 'The state of the file',
        format: 'FileState',
        enum: FileState,
    })
    @IsEnum(FileState)
    @Expose()
    state!: FileState;

    @ApiProperty({
        description: 'The creator of the file',
        type: () => UserDto,
    })
    @ValidateNested()
    @Type(() => UserDto)
    @Expose()
    creator!: UserDto;

    @ApiProperty({
        description: 'The type of the file',
        format: 'FileType',
        enum: FileType,
    })
    @IsEnum(FileType)
    @Expose()
    type!: FileType;

    @ApiProperty()
    @IsString()
    @IsOptional()
    @Expose()
    @Transform(({ value, obj }) => obj.hash ?? value ?? '')
    hash!: string | null;

    @ApiProperty()
    @IsString()
    @IsOptional()
    @Expose()
    @Transform(
        ({ value, obj }) =>
            obj.parent?.uuid ?? obj.derivedFiles?.[0]?.uuid ?? value,
    )
    relatedFileUuid?: string | undefined;
}

@Expose()
export class FileWithTopicDto extends FileDto {
    @ApiProperty({
        description: 'List of topics',
        type: () => [TopicDto],
    })
    @ValidateNested()
    @Type(() => TopicDto)
    @Expose()
    @Transform(({ obj }) => {
        let topics = obj.topics ?? [];
        if (topics.length === 0 && obj.derivedFiles?.length) {
            const derivedWithTopics = obj.derivedFiles.find(
                (f: any) => f.topics && f.topics.length > 0,
            );
            if (derivedWithTopics) {
                topics = derivedWithTopics.topics ?? [];
            }
        }
        if (topics.length === 0 && obj.parent?.topics?.length) {
            topics = obj.parent.topics;
        }
        return plainToInstance(TopicDto, topics, {
            excludeExtraneousValues: true,
        });
    })
    topics!: TopicDto[];

    // additional properties only used in frontend
    // TODO: extract them in a subclass
    @ApiProperty()
    @IsOptional()
    @IsNumber()
    @Expose()
    uploaded?: number;

    @ApiProperty()
    @IsOptional()
    @IsBoolean()
    @Expose()
    canceled?: boolean;

    @ApiProperty()
    @IsOptional()
    @IsString()
    @Expose()
    missionUUID?: string;
}
