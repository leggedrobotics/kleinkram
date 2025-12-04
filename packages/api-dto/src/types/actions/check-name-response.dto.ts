import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class CheckNameResponseDto {
    @ApiProperty({
        description: 'True if the name is available, false otherwise',
    })
    @IsBoolean()
    available!: boolean;
}
