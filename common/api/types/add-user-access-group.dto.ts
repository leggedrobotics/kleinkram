import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddUserToAccessGroupDto {
    @IsUUID()
    @ApiProperty({ description: 'Access Group UUID', format: 'uuid' })
    uuid!: string;

    @IsUUID()
    @ApiProperty({ description: 'User UUID', format: 'uuid' })
    userUUID!: string;
}
