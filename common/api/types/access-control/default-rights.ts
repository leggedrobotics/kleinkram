import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, ValidateNested } from 'class-validator';
import { Paginated } from '../pagination';
import { IsSkip } from '../../../validation/skip-validation';
import { IsTake } from '../../../validation/take-validation';
import { Type } from 'class-transformer';
import { DefaultRightDto } from './default-right.dto';

export class DefaultRights implements Paginated<DefaultRightDto> {
    @ApiProperty()
    @IsNumber()
    count!: number;

    @ApiProperty({
        type: [DefaultRightDto],
        description: 'List of default rights',
    })
    @ValidateNested()
    @Type(() => DefaultRightDto)
    data!: DefaultRightDto[];

    @ApiProperty()
    @IsSkip()
    skip!: number;

    @ApiProperty()
    @IsTake()
    take!: number;
}
