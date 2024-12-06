import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ApiUUIDProperty } from '../../../backend/src/validation/bodyDecorators';
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
