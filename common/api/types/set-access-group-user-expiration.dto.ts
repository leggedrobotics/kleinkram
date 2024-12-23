import { ApiUUIDProperty } from '../../../backend/src/validation/body-decorators';
import { IsDate } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetAccessGroupUserExpirationDto {
    @ApiUUIDProperty('Access Group User UUID')
    aguUUID!: string;

    @IsDate()
    @ApiProperty({ description: 'Expiration Date', format: 'dateString' })
    expireDate!: Date;
}
