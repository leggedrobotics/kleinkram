import { ProjectQueryDto } from '../project/project-query.dto';
import { IsRecordStringString } from '../../../validation/record-validation';
import {
    IsArray,
    IsNotEmptyObject,
    ArrayNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

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
