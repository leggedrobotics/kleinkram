import { SortablePaginatedQueryDto } from '@api-dto/pagination';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class ProjectQueryDto extends SortablePaginatedQueryDto {
    @IsOptional()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @IsUUID('4', { each: true })
    @ApiProperty({ required: false })
    projectUuids?: string[];

    @IsOptional()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @IsString({ each: true })
    @ApiProperty({ required: false })
    projectPatterns?: string[];

    @IsOptional()
    @IsUUID('4')
    @ApiProperty({ required: false })
    creatorUuid?: string;

    @IsOptional()
    @IsString()
    @IsIn(['true', 'false'])
    @ApiProperty({ required: false, default: 'false', enum: ['true', 'false'] })
    exactMatch?: string;
}
