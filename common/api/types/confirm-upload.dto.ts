import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ConfirmUploadDto {
    @ApiProperty()
    @IsBoolean()
    success!: boolean;
}
