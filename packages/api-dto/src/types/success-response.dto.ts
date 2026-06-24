import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SuccessResponseDto {
    @ApiProperty({
        description: 'Indicates the operation was successful',
        example: true,
        type: Boolean,
    })
    @IsBoolean()
    success!: boolean;
}
