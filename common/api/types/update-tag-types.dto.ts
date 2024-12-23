import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateTagTypesDto {
    @ApiProperty()
    @IsBoolean()
    success!: boolean;
}
