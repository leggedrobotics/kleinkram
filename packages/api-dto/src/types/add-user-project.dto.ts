import { AccessGroupRights } from '@kleinkram/shared';
import { ApiUUIDProperty } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class AddUserToProjectDto {
    @ApiUUIDProperty('Access Group UUID')
    uuid!: string;

    @ApiUUIDProperty('User UUID')
    userUUID!: string;

    @IsEnum(AccessGroupRights)
    @ApiProperty({ description: 'User Rights' })
    rights!: AccessGroupRights;
}
