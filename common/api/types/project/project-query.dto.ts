import { IsArray, IsString, IsOptional, IsUUID } from 'class-validator';
import { PaginatedQueryDto } from '../pagination.dto';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ProjectQueryDto extends PaginatedQueryDto {
    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @IsUUID('4', { each: true })
    @ApiProperty()
    projectUuids?: string[];

    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @IsString({ each: true })
    @ApiProperty()
    projectPatterns?: string[];
}
