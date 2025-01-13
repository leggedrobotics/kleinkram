import { IsArray, IsString, IsOptional, IsUUID } from 'class-validator';
import { PagedQuery } from '../pagination/query';
import { Transform } from 'class-transformer';

export class ProjectQueryDto extends PagedQuery {
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
