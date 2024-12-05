import { ApiProperty } from '@nestjs/swagger';
import { TagTypeDto } from '../tags/TagsDto.dto';
import { FlatMissionDto } from '../Mission.dto';
import { IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaggedResponse } from '../pagged-response';
import { IsSkip } from '../../../validation/skip-validation';
import { IsTake } from '../../../validation/take-validation';
import { BaseProjectDto } from './base-project.dto';
import { FlatProjectDto } from './flat-project.dto';

export class ProjectDto extends BaseProjectDto {
    @ApiProperty({
        type: [TagTypeDto],
        description: 'List of required tags',
    })
    @ValidateNested()
    @Type(() => TagTypeDto)
    requiredTags!: TagTypeDto[];

    @ApiProperty({
        type: [FlatMissionDto],
        description: 'List of missions',
    })
    @ValidateNested()
    @Type(() => FlatMissionDto)
    missions!: FlatMissionDto[];
}

export class ProjectsDto implements PaggedResponse<FlatProjectDto> {
    @ApiProperty()
    @ValidateNested()
    @Type(() => FlatProjectDto)
    data!: FlatProjectDto[];

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
