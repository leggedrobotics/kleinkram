/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { FlatMissionDto } from '@api-dto/mission/mission.dto';
import { ProjectWithRequiredTagsDto } from '@api-dto/project/project-with-required-tags.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

@Expose()
export class ProjectWithMissionsDto extends ProjectWithRequiredTagsDto {
    @ApiProperty({
        type: () => [FlatMissionDto],
        description: 'List of missions',
    })
    @ValidateNested()
    @Type(() => FlatMissionDto)
    @Expose()
    @Transform(({ obj }) => obj.missions ?? [])
    missions!: FlatMissionDto[];
}
