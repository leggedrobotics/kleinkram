import { Paginated } from '@api-dto/pagination';
import { ProjectDto } from '@api-dto/project/base-project.dto';
import { TagDto } from '@api-dto/tags/tags.dto';
import { UserDto } from '@api-dto/user/user.dto';
import { IsSkip, IsTake } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
    IsDate,
    IsInt,
    IsNumber,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';

@Expose()
export class MinimumMissionDto {
    @ApiProperty()
    @IsUUID()
    @Expose()
    uuid!: string;

    @ApiProperty()
    @IsString()
    @Expose()
    name!: string;
}

@Expose()
export class MissionDto extends MinimumMissionDto {
    @ApiProperty({
        description: 'The project the mission belongs to',
        type: () => ProjectDto,
    })
    @ValidateNested()
    @Type(() => ProjectDto)
    @Expose()
    project!: ProjectDto;

    @ApiProperty()
    @IsDate()
    @Expose()
    createdAt!: Date;

    @ApiProperty()
    @IsDate()
    @Expose()
    updatedAt!: Date;

    @ApiProperty({
        description: 'List of tags',
        type: () => [TagDto],
    })
    @ValidateNested()
    @Type(() => TagDto)
    @Expose()
    tags!: TagDto[];
}

@Expose()
export class MissionWithCreatorDto extends MissionDto {
    @ApiProperty({
        description: 'The creator of the mission',
        type: () => UserDto,
    })
    @ValidateNested()
    @Type(() => UserDto)
    @Expose()
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
