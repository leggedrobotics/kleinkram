import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class ReextractTopicsResponseDto {
    @ApiProperty()
    @IsNumber()
    count!: number;
}
