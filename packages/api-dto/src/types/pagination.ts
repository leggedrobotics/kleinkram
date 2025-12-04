import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const MAX_TAKE = 10_000;
const DEFAULT_TAKE = 100;
const DEFAULT_SKIP = 0;

export enum SortOrder {
    ASC = 'asc',
    DESC = 'desc',
}

export class PaginatedQueryDto {
    @IsOptional()
    @IsInt()
    @Min(0)
    @Type(() => Number)
    @ApiProperty({ required: false, default: 0 })
    skip: number = DEFAULT_SKIP;

    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(MAX_TAKE)
    @Type(() => Number)
    @ApiProperty({ required: false, default: DEFAULT_TAKE })
    take: number = DEFAULT_TAKE;
}

export class SortablePaginatedQueryDto extends PaginatedQueryDto {
    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    sortBy?: string;

    // @ts-ignore
    @Transform(({ value }) => SortOrder[value.toUpperCase()])
    @IsEnum(SortOrder)
    @ApiProperty({ required: false })
    sortOrder: SortOrder = SortOrder.ASC;
}

export interface Paginated<T> {
    data: T[];
    count: number;
    skip: number;
    take: number;
}
