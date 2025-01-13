import { IsArray, IsString, IsOptional, IsUUID } from 'class-validator';
import { PaginatedQueryDto } from '../pagination';
import { Transform } from 'class-transformer';

export class ProjectQueryDto extends PaginatedQueryDto {
    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @IsUUID('4', { each: true })
    projectUuids?: string[];

    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @IsString({ each: true })
    projectPatterns?: string[];
}
