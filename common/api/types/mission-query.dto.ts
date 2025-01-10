import { ProjectQueryDto } from './project/project-query.dto';
import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class MissionQueryDto extends ProjectQueryDto {
    @IsOptional()
    @IsArray()
    @IsUUID('4', { each: true })
    missionUuids?: string[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    missionPatterns?: string[];
}
