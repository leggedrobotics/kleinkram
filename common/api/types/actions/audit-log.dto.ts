import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AuditLogDto {
    @ApiProperty()
    @IsString()
    url!: string;

    @ApiProperty()
    @IsString()
    method!: string;

    @ApiProperty()
    @IsString()
    message!: string;
}
