/* eslint-disable @typescript-eslint/no-unsafe-return */
import { FlatMissionDto } from '@api-dto/mission/mission.dto';
import { ProjectWithRequiredMetadataTypesDto } from '@api-dto/project/project-with-required-metadata-types.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

@Expose()
export class ProjectWithMissionsDto extends ProjectWithRequiredMetadataTypesDto {
    @ApiProperty({
        type: () => [FlatMissionDto],
        description: 'List of missions',
    })
    @ValidateNested()
    @Type(() => FlatMissionDto)
    @Expose()
    @Transform(({ value }) => value ?? [])
    missions!: FlatMissionDto[];
}
