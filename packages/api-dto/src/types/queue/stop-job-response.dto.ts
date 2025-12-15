import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class StopJobResponseDto {
    @ApiProperty()
    @IsBoolean()
    success!: boolean;
}
