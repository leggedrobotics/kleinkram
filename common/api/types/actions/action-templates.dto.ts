import { ActionTemplateDto } from '@common/api/types/actions/action-template.dto';
import { Paginated } from '@common/api/types/pagination';
import { IsSkip } from '@common/validation/skip-validation';
import { IsTake } from '@common/validation/take-validation';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, ValidateNested } from 'class-validator';

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
