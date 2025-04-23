import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ApiUUIDProperty } from '../../../backend/src/validation/body-decorators';
import { AccessGroupRights } from '../../frontend_shared/enum';

export class AddUserToProjectDto {
    @ApiUUIDProperty('Access Group UUID')
    uuid!: string;

    @ApiUUIDProperty('User UUID')
    userUUID!: string;

    @IsEnum(AccessGroupRights)
    @ApiProperty({ description: 'User Rights' })
    rights!: AccessGroupRights;
}
