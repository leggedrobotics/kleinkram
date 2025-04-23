import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsDate,
    IsInt,
    IsNumber,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';
import { IsSkip } from '../../../validation/skip-validation';
import { IsTake } from '../../../validation/take-validation';
import { FileDto } from '../file/file.dto';
import { Paginated } from '../pagination';
import { ProjectDto } from '../project/base-project.dto';
import { TagDto } from '../tags/tags.dto';
import { UserDto } from '../user.dto';

export class MinimumMissionDto {
    @ApiProperty()
    @IsUUID()
    uuid!: string;

    @ApiProperty()
    @IsString()
    name!: string;
}

export class MissionDto extends MinimumMissionDto {
    @ApiProperty({
        description: 'The project the mission belongs to',
        type: () => ProjectDto,
    })
    @ValidateNested()
    @Type(() => ProjectDto)
    project!: ProjectDto;

    @ApiProperty()
    @IsDate()
    createdAt!: Date;

    @ApiProperty()
    @IsDate()
    updatedAt!: Date;

    @ApiProperty({
        description: 'List of tags',
        type: () => [TagDto],
    })
    @ValidateNested()
    @Type(() => TagDto)
    tags!: TagDto[];
}

export class MissionWithCreatorDto extends MissionDto {
    @ApiProperty({
        description: 'The creator of the mission',
        type: () => UserDto,
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
        type: () => FileDto,
        description: 'List of files',
    })
    @ValidateNested()
    @Type(() => FileDto)
    files!: FileDto[];
}

export class MissionsDto implements Paginated<FlatMissionDto> {
    @ApiProperty()
    @IsNumber()
    count!: number;

    @ApiProperty({
        description: 'List of missions',
        type: () => FlatMissionDto,
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

export class MinimumMissionsDto implements Paginated<MinimumMissionDto> {
    @ApiProperty()
    @IsNumber()
    count!: number;

    @ApiProperty({
        description: 'List of missions',
        type: () => MinimumMissionDto,
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
