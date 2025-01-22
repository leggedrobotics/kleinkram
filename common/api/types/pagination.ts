import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

const MAX_TAKE = 10_000;
const DEFAULT_TAKE = 100;

export class PaginatedQueryDto {
    @IsOptional()
    @IsInt()
    @Min(0)
    @Type(() => Number)
    skip = 0;

    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(MAX_TAKE)
    @Type(() => Number)
    take: number = DEFAULT_TAKE;
}

export interface Paginated<T> {
    data: T[];
    count: number;
    skip: number;
    take: number;
}
