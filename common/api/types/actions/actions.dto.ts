import { ActionDto } from '@common/api/types/actions/action.dto';
import { Paginated } from '@common/api/types/pagination';
import { IsSkip } from '@common/validation/skip-validation';
import { IsTake } from '@common/validation/take-validation';
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
