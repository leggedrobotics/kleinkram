import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, ValidateNested } from 'class-validator';
import { ActionTemplateDto } from '../../../api/types/actions/action-template.dto';
import { Paginated } from '../../../api/types/pagination';
import { IsSkip } from '../../../validation/skip-validation';
import { IsTake } from '../../../validation/take-validation';

export class ActionTemplatesDto implements Paginated<ActionTemplateDto> {
    @ApiProperty()
    @IsNumber()
    count!: number;

    @ApiProperty({
        type: () => [ActionTemplateDto],
        description: 'List of templates',
    })
    @ValidateNested({ each: true })
    @Type(() => ActionTemplateDto)
    data!: ActionTemplateDto[];

    @ApiProperty()
    @IsSkip()
    skip!: number;

    @ApiProperty()
    @IsTake()
    take!: number;
}
