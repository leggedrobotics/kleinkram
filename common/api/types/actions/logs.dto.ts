import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';
import { LogType } from '../../../frontend_shared/enum';

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
