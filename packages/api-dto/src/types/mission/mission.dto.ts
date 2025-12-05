import { Paginated } from '@api-dto/pagination';
import { ProjectDto } from '@api-dto/project/base-project.dto';
import { TagDto } from '@api-dto/tags/tags.dto';
import { UserDto } from '@api-dto/user/user.dto';
import { IsSkip, IsTake } from '@kleinkram/validation';
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
