import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class ResolveUsersDto {
    @IsArray()
    @IsString({ each: true })
    @ApiProperty({
        description: 'Array of User UUIDs to resolve',
        example: ['123e4567-e89b-12d3-a456-426614174000'],
    })
    uuids!: string[];
}
