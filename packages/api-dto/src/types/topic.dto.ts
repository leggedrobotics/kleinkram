/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { Paginated } from '@api-dto/pagination';
import { IsSkip, IsTake } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import {
    IsArray,
    IsDate,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';

const toDateOrNull = (value: unknown): Date | null => {
    if (value === null || value === undefined) return null;
    const date = value instanceof Date ? value : new Date(value as string);
    return Number.isNaN(date.getTime()) ? null : date;
};

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
    @Transform(({ obj }) => obj.nrMessages ?? 0n)
    nrMessages?: bigint;

    @ApiProperty({
        description:
            'Messages per second between firstSeen and lastSeen. 0 for a one-shot topic (seen in fewer than 5 chunks). Where firstSeen is null, the message count over the whole recording.',
    })
    @IsNumber()
    @Expose()
    @Transform(({ obj }) => (Number.isNaN(obj.frequency) ? 0 : obj.frequency))
    frequency!: number;

    @ApiProperty({
        description:
            'Start of the first chunk holding the topic (accurate to one chunk), null while unknown',
        type: Date,
        nullable: true,
    })
    @IsDate()
    @IsOptional()
    @Expose()
    @Transform(({ obj }) => toDateOrNull(obj.firstSeen))
    firstSeen!: Date | null;

    @ApiProperty({
        description:
            'End of the last chunk holding the topic, null while unknown',
        type: Date,
        nullable: true,
    })
    @IsDate()
    @IsOptional()
    @Expose()
    @Transform(({ obj }) => toDateOrNull(obj.lastSeen))
    lastSeen!: Date | null;

    @ApiProperty({
        description:
            'Chunks with at least one message of the topic, null while unknown',
        type: Number,
        nullable: true,
    })
    @IsInt()
    @IsOptional()
    @Expose()
    @Transform(({ obj }) => obj.chunkCount ?? null)
    chunkCount!: number | null;

    @ApiProperty({
        description:
            "Where the topic has data: [startMs, endMs] spans in milliseconds since the file's recording start, null while unknown",
        type: 'array',
        items: { type: 'array', items: { type: 'number' } },
        nullable: true,
    })
    @IsArray()
    @IsOptional()
    @Expose()
    @Transform(({ obj }) => obj.coverage ?? null)
    coverage!: [number, number][] | null;
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

export class TopicTypesDto implements Paginated<string> {
    @ApiProperty()
    @IsNumber()
    count!: number;

    @ApiProperty({
        type: () => [String],
        description: 'List of topic types',
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
