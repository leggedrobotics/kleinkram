import { LogType } from '@kleinkram/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';

export class LogsDto {
    @ApiProperty()
    @IsString()
    timestamp!: string;

    @ApiProperty()
    @IsString()
    message!: string;

    @ApiProperty()
    @IsEnum(LogType)
    type!: LogType;
}
