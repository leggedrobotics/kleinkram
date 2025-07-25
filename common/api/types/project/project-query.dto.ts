import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';
import { SortablePaginatedQueryDto } from '../pagination';

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

    @IsOptional()
    @IsUUID('4')
    @ApiProperty({ required: false })
    creatorUuid?: string;
}
