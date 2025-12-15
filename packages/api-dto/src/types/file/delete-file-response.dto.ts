import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class DeleteFileResponseDto {
    @ApiProperty()
    @IsBoolean()
    success!: boolean;
}
