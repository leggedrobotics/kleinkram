import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class RemoveUsersFromAccessGroupDto {
    @IsArray()
    @IsUUID('all', { each: true })
    @ApiProperty({
        description: 'Array of User UUIDs to remove',
        type: [String],
    })
    userUuids!: string[];
}
