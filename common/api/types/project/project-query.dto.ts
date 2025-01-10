import { IsArray, IsString, IsOptional, IsUUID } from 'class-validator';

export class ProjectQueryDto {
    @IsOptional()
    @IsArray()
    @IsUUID('4', { each: true })
    projectUuids?: string[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    projectPatterns?: string[];
}
