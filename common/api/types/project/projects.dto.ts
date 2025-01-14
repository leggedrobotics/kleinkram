import { Paginated } from '../pagination';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsSkip } from '../../../validation/skip-validation';
import { IsTake } from '../../../validation/take-validation';
import { ProjectWithMissionCountDto } from './project-with-mission-count.dto';

export class ProjectsDto implements Paginated<ProjectWithMissionCountDto> {
    @ApiProperty({
        type: [ProjectWithMissionCountDto],
        description: 'List of projects',
    })
    @ValidateNested()
    @Type(() => ProjectWithMissionCountDto)
    data!: ProjectWithMissionCountDto[];

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
