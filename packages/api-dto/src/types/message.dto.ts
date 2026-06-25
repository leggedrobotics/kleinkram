import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class MessageDto {
    @ApiProperty({
        description: 'A message describing the response status',
        example: 'Token is valid',
        type: String,
    })
    @IsString()
    message!: string;
}
