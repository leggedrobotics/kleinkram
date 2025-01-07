import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from './user.dto';
import { TagDto } from './tags/tags.dto';
import {
    IsDate,
    IsInt,
    IsNumber,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProjectDto } from './project/base-project.dto';
import { FileDto } from './files/file.dto';
import { PaggedResponse } from './pagged-response';
import { IsSkip } from '../../validation/skip-validation';
import { IsTake } from '../../validation/take-validation';

export class MinimumMissionDto {
    @ApiProperty()
    @IsUUID()
    uuid!: string;

    @ApiProperty()
    @IsString()
    name!: string;

    @ApiProperty({
        description: 'The project the mission belongs to',
        type: ProjectDto,
    })
    @ValidateNested()
    @Type(() => ProjectDto)
    project!: ProjectDto;
}

export class MissionDto extends MinimumMissionDto {
    @ApiProperty()
    @IsDate()
    createdAt!: Date;

    @ApiProperty()
    @IsDate()
    updatedAt!: Date;

    @ApiProperty({
        description: 'List of tags',
        type: [TagDto],
    })
    @ValidateNested()
    @Type(() => TagDto)
    tags!: TagDto[];
}

export class MissionWithCreatorDto extends MissionDto {
    @ApiProperty({
        description: 'The creator of the mission',
        type: UserDto,
    })
    @ValidateNested()
    @Type(() => UserDto)
    creator!: UserDto;
}

export class FlatMissionDto extends MissionWithCreatorDto {
    @ApiProperty()
    @IsNumber()
    filesCount!: number;

    @ApiProperty()
    @IsInt()
    size!: number;
}

export class MissionWithFilesDto extends MissionWithCreatorDto {
    @ApiProperty({
        description: 'List of files',
        type: FileDto,
    })
    @ValidateNested()
    @Type(() => FileDto)
    files!: FileDto[];
}

export class MissionsDto implements PaggedResponse<FlatMissionDto> {
    @ApiProperty()
    @IsNumber()
    count!: number;

    @ApiProperty({
        description: 'List of missions',
        type: FlatMissionDto,
    })
    @ValidateNested()
    @Type(() => FlatMissionDto)
    data!: FlatMissionDto[];

    @ApiProperty()
    @IsSkip()
    skip!: number;

    @ApiProperty()
    @IsTake()
    take!: number;
}

export class MinimumMissionsDto implements PaggedResponse<MinimumMissionDto> {
    @ApiProperty()
    @IsNumber()
    count!: number;

    @ApiProperty({
        description: 'List of missions',
        type: MinimumMissionDto,
    })
    @ValidateNested()
    @Type(() => MinimumMissionDto)
    data!: MinimumMissionDto[];

    @ApiProperty()
    @IsSkip()
    skip!: number;

    @ApiProperty()
    @IsTake()
    take!: number;
}
