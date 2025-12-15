import { Paginated } from '@api-dto/pagination';
import { IsSkip, IsTake } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsArray, IsNumber, IsString, ValidateNested } from 'class-validator';

@Expose()
export class TopicDto {
    @ApiProperty()
    @IsString()
    @Expose()
    name!: string;

    @ApiProperty()
    @IsString()
    @Expose()
    type!: string;

    @ApiProperty()
    @IsNumber()
    @Expose()
    nrMessages?: bigint;

    @ApiProperty()
    @IsNumber()
    @Expose()
    frequency!: number;
}

export class TopicsDto implements Paginated<TopicDto> {
    @ApiProperty({
        type: () => [TopicDto],
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
        type: () => [String],
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
