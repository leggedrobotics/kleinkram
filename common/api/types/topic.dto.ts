import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, ValidateNested } from 'class-validator';
import { PaggedResponse } from './pagged-response';
import { IsSkip } from '../../validation/skip-validation';
import { IsTake } from '../../validation/take-validation';
import { Type } from 'class-transformer';

export class TopicDto {
    @ApiProperty()
    @IsString()
    name!: string;

    @ApiProperty()
    @IsString()
    type!: string;

    @ApiProperty()
    @IsNumber()
    nrMessages?: bigint;

    @ApiProperty()
    @IsNumber()
    frequency!: number;
}

export class TopicsDto implements PaggedResponse<TopicDto> {
    @ApiProperty({
        type: [TopicDto],
        description: 'List of topics',
    })
    @ValidateNested()
    @Type(() => TopicDto)
    data!: TopicDto[];

    @ApiProperty()
    @IsSkip()
    skip!: number;

    @ApiProperty()
    @IsTake()
    take!: number;

    @ApiProperty()
    @IsNumber()
    count!: number;
}

export class TopicNamesDto implements PaggedResponse<string> {
    @ApiProperty()
    @IsNumber()
    count!: number;

    @ApiProperty({
        type: [String],
        description: 'List of topic names',
    })
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
