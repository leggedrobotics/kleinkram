import { ApiProperty } from '@nestjs/swagger';
import { MissionDto, MissionWithCreatorDto } from '../Mission.dto';
import { CategoryDto } from '../Category.dto';
import { FileState, FileType } from '../../../frontend_shared/enum';
import { UserDto } from '../User.dto';
import { TopicDto } from '../Topic.dto';
import {
    IsDate,
    IsEnum,
    IsNumber,
    IsString,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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
    missionUuid?: string;
}
