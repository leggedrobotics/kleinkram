import {
    AccessGroupRights,
    GRANTABLE_ACCESS_GROUP_RIGHTS,
} from '@kleinkram/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class AddAccessGroupToProjectDto {
    @IsIn(GRANTABLE_ACCESS_GROUP_RIGHTS)
    @ApiProperty({
        description: 'Access Group Rights',
        format: 'AccessGroupRights',
        enum: GRANTABLE_ACCESS_GROUP_RIGHTS,
    })
    rights!: AccessGroupRights;
}
