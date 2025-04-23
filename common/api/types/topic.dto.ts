import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsString, ValidateNested } from 'class-validator';
import { IsSkip } from '../../validation/skip-validation';
import { IsTake } from '../../validation/take-validation';
import { Paginated } from './pagination';

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

export class TopicsDto implements Paginated<TopicDto> {
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

export class TopicNamesDto implements Paginated<string> {
    @ApiProperty()
    @IsNumber()
    count!: number;

    @ApiProperty({
        type: [String],
        description: 'List of topic names',
    })
    @IsArray()
    @IsString({ each: true })
    data!: string[];

    @ApiProperty()
    @IsSkip()
    skip!: number;

    @ApiProperty()
    @IsTake()
    take!: number;
}
