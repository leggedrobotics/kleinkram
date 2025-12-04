import { ProjectQueryDto } from '@api-dto/project/project-query.dto';
import { IsRecordStringString } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    ArrayNotEmpty,
    IsArray,
    IsNotEmptyObject,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';

export class MissionQueryDto extends ProjectQueryDto {
    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayNotEmpty()
    @IsUUID('4', { each: true })
    @ApiProperty({ required: false })
    missionUuids?: string[];

    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    @ApiProperty({ required: false })
    missionPatterns?: string[];

    @IsOptional()
    @IsNotEmptyObject()
    @IsRecordStringString()
    @ApiProperty({ required: false })
    metadata?: Record<string, string>;
}
