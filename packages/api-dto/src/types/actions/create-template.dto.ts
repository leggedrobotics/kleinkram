import { AccessGroupRights } from '@kleinkram/shared';
import { IsDockerImage, IsValidName } from '@kleinkram/validation';
import {
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
} from 'class-validator';

/**
 * Everything a template version consists of, except its name. The name is
 * checked differently when creating a template and when adding a version.
 */
export class TemplateFieldsDto {
    @IsString()
    @IsNotEmpty()
    description!: string;

    @IsString()
    @IsOptional()
    command?: string;

    @IsString()
    @IsNotEmpty()
    @IsDockerImage()
    dockerImage!: string;

    @IsNumber()
    cpuCores!: number;

    @IsNumber()
    cpuMemory!: number;

    @IsNumber()
    gpuMemory!: number;

    @IsNumber()
    maxRuntime!: number;

    @IsString()
    @IsOptional()
    entrypoint?: string;

    @IsEnum(AccessGroupRights)
    accessRights!: AccessGroupRights;
}

export class CreateTemplateDto extends TemplateFieldsDto {
    // a new name follows the naming rules (`name.validation.ts`)
    @IsString()
    @IsNotEmpty()
    @IsValidName('Template name')
    name!: string;
}
