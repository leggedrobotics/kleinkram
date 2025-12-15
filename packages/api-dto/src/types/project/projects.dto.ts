import { Paginated } from '@api-dto/pagination';
import { ProjectWithMissionCountDto } from '@api-dto/project/project-with-mission-count.dto';
import { ProjectWithRequiredTagsDto } from '@api-dto/project/project-with-required-tags.dto';
import { IsSkip, IsTake } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, ValidateNested } from 'class-validator';

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
