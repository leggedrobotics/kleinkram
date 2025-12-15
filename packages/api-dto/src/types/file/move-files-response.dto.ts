import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class MoveFilesResponseDto {
    @ApiProperty()
    @IsBoolean()
    success!: boolean;
}
