import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AddUserToAccessGroupDto {
    @IsUUID()
    @ApiProperty({ description: 'User UUID', format: 'uuid' })
    userUuid!: string;
}
