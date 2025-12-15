import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber } from 'class-validator';

export class RecalculateHashesResponseDto {
    @ApiProperty()
    @IsBoolean()
    success!: boolean;

    @ApiProperty()
    @IsNumber()
    fileCount!: number;
}
