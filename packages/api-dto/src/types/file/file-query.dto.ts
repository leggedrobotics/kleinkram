import { MissionQueryDto } from '@api-dto/mission/mission-query.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    ArrayNotEmpty,
    IsArray,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';

export class FileQueryDto extends MissionQueryDto {
    @IsOptional()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayNotEmpty()
    @IsUUID('4', { each: true })
    @ApiProperty({ required: false })
    fileUuids?: string[];

    @IsOptional()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    @ApiProperty({ required: false })
    filePatterns?: string[];

    @IsOptional()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    @ApiProperty({ required: false })
    fileExtensions?: string[];

    @IsOptional()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    @ApiProperty({ required: false })
    topicPatterns?: string[];

    @IsOptional()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    @ApiProperty({ required: false })
    categoryPatterns?: string[];
}
