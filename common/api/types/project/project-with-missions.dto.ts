import { ApiProperty } from '@nestjs/swagger';
import { FlatMissionDto } from '../mission/mission.dto';
import { ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ProjectWithRequiredTags } from './project-with-required-tags';

export class ProjectWithMissionsDto extends ProjectWithRequiredTags {
    @ApiProperty({
        type: [FlatMissionDto],
        description: 'List of missions',
    })
    @ValidateNested()
    @Type(() => FlatMissionDto)
    missions!: FlatMissionDto[];
}
