import { Paginated } from '../pagination';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsSkip } from '../../../validation/skip-validation';
import { IsTake } from '../../../validation/take-validation';
import { AccessGroupDto } from '../user.dto';

export class AccessGroupsDto implements Paginated<AccessGroupDto> {
    @ApiProperty()
    @IsNumber()
    count!: number;

    @ApiProperty({
        type: [AccessGroupDto],
        description: 'List of access groups',
    })
    @ValidateNested()
    @Type(() => AccessGroupDto)
    data!: AccessGroupDto[];

    @ApiProperty()
    @IsSkip()
    skip!: number;

    @ApiProperty()
    @IsTake()
    take!: number;
}
