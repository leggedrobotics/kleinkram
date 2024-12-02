import { ApiProperty } from '@nestjs/swagger';
import { TagDto } from './TagsDto.dto';
import { FlatMissionDto } from './Mission.dto';
import { UserDto } from './User.dto';

export class BaseProjectDto {
    @ApiProperty()
    uuid!: string;

    @ApiProperty()
    name!: string;

    @ApiProperty()
    createdAt!: Date;

    @ApiProperty()
    updatedAt!: Date;

    @ApiProperty()
    description!: string;

    @ApiProperty()
    creator!: UserDto;
}

export class FlatProjectDto extends BaseProjectDto {
    @ApiProperty()
    missionCount!: number;
}

export class ProjectDto extends BaseProjectDto {
    @ApiProperty()
    requiredTags!: TagDto[];

    @ApiProperty()
    missions!: FlatMissionDto[];
}

export class ProjectsDto {
    @ApiProperty()
    projects!: FlatProjectDto[];

    @ApiProperty()
    count!: number;
}

export class ProjectAccessDto extends FlatProjectDto {}
