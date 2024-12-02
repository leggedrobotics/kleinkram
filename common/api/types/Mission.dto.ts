import { ApiProperty } from '@nestjs/swagger';
import { BaseProjectDto } from './Project.dto';
import { UserDto } from './User.dto';
import { TagsDto } from './TagsDto.dto';
import { FilesDto } from './Files.dto';

export class FlatMissionDto {
    @ApiProperty()
    uuid!: string;

    @ApiProperty()
    createdAt!: Date;

    @ApiProperty()
    updatedAt!: Date;

    @ApiProperty()
    name!: string;

    @ApiProperty()
    project!: BaseProjectDto;

    @ApiProperty()
    creator!: UserDto;

    @ApiProperty()
    tags!: TagsDto;
}

export class MissionDto extends FlatMissionDto {
    @ApiProperty()
    files!: FilesDto;
}

export class MissionsDto {
    @ApiProperty()
    count!: number;

    @ApiProperty()
    missions!: FlatMissionDto[];
}
