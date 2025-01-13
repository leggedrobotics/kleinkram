import { ProjectQueryDto } from './project/project-query.dto';
import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class MissionQueryDto extends ProjectQueryDto {
    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @IsUUID('4', { each: true })
    missionUuids?: string[];

    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @IsString({ each: true })
    missionPatterns?: string[];
}
