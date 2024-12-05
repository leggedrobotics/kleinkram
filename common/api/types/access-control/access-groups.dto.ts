import { PaggedResponse } from '../pagged-response';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsSkip } from '../../../validation/skip-validation';
import { IsTake } from '../../../validation/take-validation';
import { AccessGroupDto, GroupMembershipDto } from '../User.dto';

export class AccessGroupsDto implements PaggedResponse<AccessGroupDto> {
    @ApiProperty()
    @IsNumber()
    count!: number;

    @ApiProperty({
        type: GroupMembershipDto,
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
