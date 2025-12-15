import { FlatMissionDto } from '@api-dto/mission/mission.dto';
import { ProjectWithRequiredTagsDto } from '@api-dto/project/project-with-required-tags.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

export class ProjectWithMissionsDto extends ProjectWithRequiredTagsDto {
    @ApiProperty({
        type: () => [FlatMissionDto],
        description: 'List of missions',
    })
    @ValidateNested()
    @Type(() => FlatMissionDto)
    missions!: FlatMissionDto[];
}
