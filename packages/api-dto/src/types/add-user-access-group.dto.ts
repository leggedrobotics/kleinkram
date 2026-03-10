import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class AddUserToAccessGroupDto {
    @IsUUID()
    @ApiProperty({ description: 'User UUID', format: 'uuid' })
    userUuid!: string;

    @ApiProperty({
        description: 'Whether the user can edit the access group',
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    canEditGroup?: boolean;

    @ApiProperty({
        description: 'Expiration date or never',
        required: false,
    })
    @IsOptional()
    expireDate?: Date | 'never';
}
