import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, ValidateNested } from 'class-validator';
import { PaggedResponse } from './pagged-response';
import { IsSkip } from '../../validation/skip-validation';
import { IsTake } from '../../validation/take-validation';
import { Type } from 'class-transformer';

export class TopicDto {}

export class TopicsDto {
    @ApiProperty()
    @IsNumber()
    count!: number;

    //@ApiProperty()
    //files!: TopicDto[];
}

export class TopicNamesDto implements PaggedResponse<string> {
    @ApiProperty()
    @IsNumber()
    count!: number;

    @ApiProperty()
    @ValidateNested()
    @Type(() => String)
    data!: string[];

    @ApiProperty()
    @IsSkip()
    skip!: number;

    @ApiProperty()
    @IsTake()
    take!: number;
}
