import { ProjectWithCreator } from '@api-dto/project/project-with-creator.dto';
import { TagTypeDto } from '@api-dto/tags/tags.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, ValidateNested } from 'class-validator';

export class ProjectWithRequiredTagsDto extends ProjectWithCreator {
    @ApiProperty({
        description: 'Number of missions',
    })
    @IsNumber()
    missionCount!: number;

    @ApiProperty({
        description: 'Total size of files in byte',
    })
    @IsNumber()
    size!: number;

    @ApiProperty({
        type: () => [TagTypeDto],
        description: 'List of required tags',
    })
    @ValidateNested()
    @Type(() => TagTypeDto)
    requiredTags!: TagTypeDto[];
}
