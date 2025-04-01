import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TagTypeDto } from '../tags/tags.dto';
import { ProjectWithCreator } from './project-with-creator.dto';

export class ProjectWithRequiredTags extends ProjectWithCreator {
    @ApiProperty({
        description: 'Number of missions',
    })
    @IsNumber()
    missionCount!: number;

    @ApiProperty({
        type: [TagTypeDto],
        description: 'List of required tags',
    })
    @ValidateNested()
    @Type(() => TagTypeDto)
    requiredTags!: TagTypeDto[];
}
