import { IsArray, IsString, IsOptional, IsUUID } from 'class-validator';
import { SortablePaginatedQueryDto } from '../pagination';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ProjectQueryDto extends SortablePaginatedQueryDto {
    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @IsUUID('4', { each: true })
    @ApiProperty({ required: false })
    projectUuids?: string[];

    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @IsString({ each: true })
    @ApiProperty({ required: false })
    projectPatterns?: string[];
}
