import { IsInt, IsOptional, IsString, IsEnum, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

const MAX_TAKE = 10_000;
const DEFAULT_TAKE = 100;

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
    skip = 0;

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
