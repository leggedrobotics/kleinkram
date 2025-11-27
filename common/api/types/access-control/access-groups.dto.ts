import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, ValidateNested } from 'class-validator';

import { AccessGroupDto } from '@common/api/types/access-control/access-group.dto';
import { Paginated } from '@common/api/types/pagination';
import { IsSkip } from '@common/validation/skip-validation';
import { IsTake } from '@common/validation/take-validation';

export class AccessGroupsDto implements Paginated<AccessGroupDto> {
    @ApiProperty()
    @IsNumber()
    count!: number;

    @ApiProperty({
        type: () => [AccessGroupDto],
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
