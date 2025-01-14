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

import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class MissionQueryDto extends ProjectQueryDto {
    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayNotEmpty()
    @IsUUID('4', { each: true })
    @ApiProperty()
    missionUuids?: string[];

    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    @ApiProperty()
    missionPatterns?: string[];

    @IsOptional()
    @IsNotEmptyObject()
    @IsRecordStringString()
    @ApiProperty()
    metadata?: Record<string, string>;
}
