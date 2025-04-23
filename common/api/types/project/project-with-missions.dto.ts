import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { FlatMissionDto } from '../mission/mission.dto';
import { ProjectWithRequiredTags } from './project-with-required-tags';

export class ProjectWithMissionsDto extends ProjectWithRequiredTags {
    @ApiProperty({
        type: () => [FlatMissionDto],
        description: 'List of missions',
    })
    @ValidateNested()
    @Type(() => FlatMissionDto)
    missions!: FlatMissionDto[];
}
