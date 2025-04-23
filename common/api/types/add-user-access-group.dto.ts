import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AddUserToAccessGroupDto {
    @IsUUID()
    @ApiProperty({ description: 'Access Group UUID', format: 'uuid' })
    uuid!: string;

    @IsUUID()
    @ApiProperty({ description: 'User UUID', format: 'uuid' })
    userUUID!: string;
}
