import { ActionDto } from '@api-dto/actions/action.dto';
import { Paginated } from '@api-dto/pagination';
import { IsSkip, IsTake } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, ValidateNested } from 'class-validator';

export class ActionsDto implements Paginated<ActionDto> {
    @ApiProperty()
    @IsNumber()
    count!: number;

    @ApiProperty({
        type: () => [ActionDto],
        description: 'List of actions',
    })
    @ValidateNested({ each: true })
    @Type(() => ActionDto)
    data!: ActionDto[];

    @ApiProperty()
    @IsSkip()
    skip!: number;

    @ApiProperty()
    @IsTake()
    take!: number;
}
