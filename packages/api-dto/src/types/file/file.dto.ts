import { CategoryDto } from '@api-dto/category.dto';
import { MissionDto } from '@api-dto/mission/mission.dto';
import { TopicDto } from '@api-dto/topic.dto';
import { UserDto } from '@api-dto/user/user.dto';
import { FileState, FileType } from '@kleinkram/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
    IsBoolean,
    IsDate,
    IsEnum,
    IsNumber,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';

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

    @ApiProperty()
    @IsDate()
    @Expose()
    date!: Date;

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
    hash!: string | null;

    @ApiProperty()
    @IsString()
    @IsOptional()
    @Expose()
    relatedFileUuid?: string | undefined;
}

export class FileWithTopicDto extends FileDto {
    @ApiProperty({
        description: 'List of topics',
        type: () => [TopicDto],
    })
    @ValidateNested()
    @Type(() => TopicDto)
    @Expose()
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
