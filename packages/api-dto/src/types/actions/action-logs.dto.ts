import { LogsDto } from '@api-dto/actions/logs.dto';
import { Paginated } from '@api-dto/pagination';
import { IsSkip, IsTake } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, ValidateNested } from 'class-validator';

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
