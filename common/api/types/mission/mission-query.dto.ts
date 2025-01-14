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

export class MissionQueryDto extends ProjectQueryDto {
    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayNotEmpty()
    @IsUUID('4', { each: true })
    missionUuids?: string[];

    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    missionPatterns?: string[];

    @IsOptional()
    @IsNotEmptyObject()
    @IsRecordStringString()
    metadata?: Record<string, string>;
}
