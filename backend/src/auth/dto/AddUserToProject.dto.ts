import { IsEnum } from 'class-validator';
import { AccessGroupRights } from '@common/enum';
import { ApiProperty } from '@nestjs/swagger';
import { ApiUUIDProperty } from '../../validation/bodyDecorators';

export class AddUserToProjectDto {
    @ApiUUIDProperty('Access Group UUID')
    uuid: string;

    @ApiUUIDProperty('User UUID')
    userUUID: string;

    @IsEnum(AccessGroupRights)
    @ApiProperty({ description: 'User Rights' })
    rights: AccessGroupRights;
}
