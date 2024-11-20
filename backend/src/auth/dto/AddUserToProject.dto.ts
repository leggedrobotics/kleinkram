import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ApiUUIDProperty } from '../../validation/bodyDecorators';

import { AccessGroupRights } from '@common/frontend_shared/enum';

export class AddUserToProjectDto {
    @ApiUUIDProperty('Access Group UUID')
    uuid: string;

    @ApiUUIDProperty('User UUID')
    userUUID: string;

    @IsEnum(AccessGroupRights)
    @ApiProperty({ description: 'User Rights' })
    rights: AccessGroupRights;
}
