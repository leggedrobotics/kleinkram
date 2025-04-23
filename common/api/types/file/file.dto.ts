import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsDate,
    IsEnum,
    IsNumber,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';
import { FileState, FileType } from '../../../frontend_shared/enum';
import { CategoryDto } from '../category.dto';
import { MissionDto } from '../mission/mission.dto';
import { TopicDto } from '../topic.dto';
import { UserDto } from '../user.dto';

export class FileDto {
    @ApiProperty()
    @IsString()
    uuid!: string;

    @ApiProperty()
    @IsString()
    filename!: string;

    @ApiProperty()
    @IsDate()
    date!: Date;

    @ApiProperty()
    @IsDate()
    createdAt!: Date;

    @ApiProperty()
    @IsDate()
    updatedAt!: Date;

    @ApiProperty({
        description: 'The mission the file belongs to',
        type: [MissionDto],
    })
    @ValidateNested()
    @Type(() => MissionDto)
    mission!: MissionDto;

    @ApiProperty({
        description: 'List of categories',
        type: [CategoryDto],
    })
    @ValidateNested()
    @Type(() => CategoryDto)
    categories!: CategoryDto[];

    @ApiProperty()
    @IsNumber()
    size!: number;

    @ApiProperty({
        description: 'The state of the file',
        format: 'FileState',
        enum: FileState,
    })
    @IsEnum(FileState)
    state!: FileState;

    @ApiProperty({
        description: 'The creator of the file',
        type: UserDto,
    })
    @ValidateNested()
    @Type(() => UserDto)
    creator!: UserDto;

    @ApiProperty({
        description: 'The type of the file',
        format: 'FileType',
        enum: FileType,
    })
    @IsEnum(FileType)
    type!: FileType;

    @ApiProperty()
    @IsString()
    hash!: string;

    @ApiProperty()
    @IsString()
    @IsOptional()
    relatedFileUuid?: string | undefined;
}

export class FileWithTopicDto extends FileDto {
    @ApiProperty({
        description: 'List of topics',
        type: [TopicDto],
    })
    @ValidateNested()
    @Type(() => TopicDto)
    topics!: TopicDto[];

    // additional properties only used in frontend
    // TODO: extract them in a subclass
    uploaded?: number;
    canceled?: boolean;
    missionUUID?: string;
}
