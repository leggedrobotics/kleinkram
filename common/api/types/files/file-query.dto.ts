import { MissionQueryDto } from '../mission-query.dto';
import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class FileQueryDto extends MissionQueryDto {
    @IsOptional()
    @IsArray()
    @IsUUID('4', { each: true })
    fileUuids?: string[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    filePatterns?: string[];
}
