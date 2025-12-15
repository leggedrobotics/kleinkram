import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class CancelUploadResponseDto {
    @ApiProperty()
    @IsBoolean()
    success!: boolean;
}
