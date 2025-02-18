import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsEnum, IsString } from 'class-validator';

export class LogsDto {
    @ApiProperty()
    @IsString()
    timestamp!: Date;

    @ApiProperty()
    @IsString()
    message!: string;

    @ApiProperty()
    @IsEnum(['stdout', 'stderr'])
    type!: 'stdout' | 'stderr';
}
