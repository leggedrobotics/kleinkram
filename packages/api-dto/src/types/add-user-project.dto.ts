import { AccessGroupRights } from '@kleinkram/shared';
import { ApiUUIDProperty } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class AddUserToProjectDto {
    @ApiUUIDProperty('User UUID')
    userUuid!: string;

    @IsEnum(AccessGroupRights)
    @ApiProperty({ description: 'User Rights' })
    rights!: AccessGroupRights;
}
