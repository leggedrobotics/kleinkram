import {
    AccessGroupRights,
    GRANTABLE_ACCESS_GROUP_RIGHTS,
} from '@kleinkram/shared';
import { ApiUUIDProperty } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class AddUserToProjectDto {
    @ApiUUIDProperty('User UUID')
    userUuid!: string;

    @IsIn(GRANTABLE_ACCESS_GROUP_RIGHTS)
    @ApiProperty({
        description: 'User Rights',
        format: 'AccessGroupRights',
        enum: GRANTABLE_ACCESS_GROUP_RIGHTS,
    })
    rights!: AccessGroupRights;
}
