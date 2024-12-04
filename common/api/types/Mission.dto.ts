import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from './User.dto';
import { TagDto } from './tags/TagsDto.dto';
import {
    IsDate,
    IsNumber,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FilesDto } from './files/files.dto';
import { BaseProjectDto } from './project/base-project.dto';
import { FileDto } from './files/file.dto';

export class BaseMissionDto {
    @ApiProperty()
    @IsUUID()
    uuid!: string;

    @ApiProperty()
    @IsDate()
    createdAt!: Date;

    @ApiProperty()
    @IsDate()
    updatedAt!: Date;

    @ApiProperty()
    @IsString()
    name!: string;

    @ApiProperty({
        description: 'The project the mission belongs to',
        type: BaseProjectDto,
    })
    @ValidateNested()
    @Type(() => BaseProjectDto)
    project!: BaseProjectDto;

    @ApiProperty({
        description: 'The creator of the mission',
        type: UserDto,
    })
    @ValidateNested()
    @Type(() => UserDto)
    creator!: UserDto;

    @ApiProperty({
        description: 'List of tags',
        type: [TagDto],
    })
    @ValidateNested()
    @Type(() => TagDto)
    tags!: TagDto[];
}

export class FlatMissionDto extends BaseMissionDto {
    @ApiProperty()
    @IsNumber()
    filesCount!: number;
}

export class MissionDto extends BaseMissionDto {
    @ApiProperty({
        description: 'List of files',
        type: FilesDto,
    })
    @ValidateNested()
    @Type(() => FileDto)
    files!: FileDto[];
}

export class MissionsDto {
    @ApiProperty()
    @IsNumber()
    count!: number;

    @ApiProperty({
        description: 'List of missions',
        type: [FlatMissionDto],
    })
    @ValidateNested()
    @Type(() => FlatMissionDto)
    missions!: FlatMissionDto[];
}
