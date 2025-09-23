import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { FlatMissionDto } from '../mission/mission.dto';
import { ProjectWithRequiredTagsDto } from './project-with-required-tags.dto';

export class ProjectWithMissionsDto extends ProjectWithRequiredTagsDto {
    @ApiProperty({
        type: () => [FlatMissionDto],
        description: 'List of missions',
    })
    @ValidateNested()
    @Type(() => FlatMissionDto)
    missions!: FlatMissionDto[];
}
