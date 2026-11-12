import { Paginated } from '@api-dto/pagination';
import { ProjectWithMissionCountDto } from '@api-dto/project/project-with-mission-count.dto';
import { ProjectWithRequiredMetadataTypesDto } from '@api-dto/project/project-with-required-metadata-types.dto';
import { IsSkip, IsTake } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, ValidateNested } from 'class-validator';

export class ProjectsDto implements Paginated<ProjectWithMissionCountDto> {
    @ApiProperty({
        type: () => [ProjectWithRequiredMetadataTypesDto],
        description: 'List of projects',
    })
    @ValidateNested()
    @Type(() => ProjectWithRequiredMetadataTypesDto)
    data!: ProjectWithRequiredMetadataTypesDto[];

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
