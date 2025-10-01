import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, ValidateNested } from 'class-validator';
import { IsSkip } from '../../../validation/skip-validation';
import { IsTake } from '../../../validation/take-validation';
import { Paginated } from '../pagination';
import { ProjectWithMissionCountDto } from './project-with-mission-count.dto';
import { ProjectWithRequiredTagsDto } from './project-with-required-tags.dto';

export class ProjectsDto implements Paginated<ProjectWithMissionCountDto> {
    @ApiProperty({
        type: () => [ProjectWithRequiredTagsDto],
        description: 'List of projects',
    })
    @ValidateNested()
    @Type(() => ProjectWithRequiredTagsDto)
    data!: ProjectWithRequiredTagsDto[];

    @ApiProperty()
    @IsNumber()
    count!: number;

    @ApiProperty()
    @IsSkip()
    skip!: number;

    @ApiProperty()
    @IsTake()
    take!: number;
}
