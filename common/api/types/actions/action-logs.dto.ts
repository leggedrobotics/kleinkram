import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, ValidateNested } from 'class-validator';
import { Paginated } from '../../../api/types/pagination';
import { IsSkip } from '../../../validation/skip-validation';
import { IsTake } from '../../../validation/take-validation';
import { LogsDto } from './logs.dto';

export class ActionLogsDto implements Paginated<LogsDto> {
    @ApiProperty()
    @IsNumber()
    count!: number;

    @ApiProperty({
        type: () => [LogsDto],
        description: 'List of action logs',
    })
    @ValidateNested({ each: true })
    @Type(() => LogsDto)
    data!: LogsDto[];

    @ApiProperty()
    @IsSkip()
    skip!: number;

    @ApiProperty()
    @IsTake()
    take!: number;
}
