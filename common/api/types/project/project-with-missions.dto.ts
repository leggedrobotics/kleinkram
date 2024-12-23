import { ApiProperty } from '@nestjs/swagger';
import { TagTypeDto } from '../tags/tags.dto';
import { FlatMissionDto } from '../mission.dto';
import { ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ProjectWithCreator } from './base-project.dto';

export class ProjectWithMissionsDto extends ProjectWithCreator {
    @ApiProperty({
        type: [TagTypeDto],
        description: 'List of required tags',
    })
    @ValidateNested()
    @Type(() => TagTypeDto)
    requiredTags!: TagTypeDto[];

    @ApiProperty({
        type: [FlatMissionDto],
        description: 'List of missions',
    })
    @ValidateNested()
    @Type(() => FlatMissionDto)
    missions!: FlatMissionDto[];
}
