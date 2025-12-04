import { ActionTemplateDto } from '@api-dto/actions/action-template.dto';
import { Paginated } from '@api-dto/pagination';
import { IsSkip, IsTake } from '@kleinkram/validation';
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
