import { AccessGroupRights } from '@common/frontend_shared/enum';
import {
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
} from 'class-validator';

export class CreateTemplateDto {
    @IsString()
    @IsNotEmpty()
    name!: string;

    @IsString()
    @IsNotEmpty()
    description!: string;

    @IsString()
    @IsOptional()
    command?: string;

    @IsString()
    @IsNotEmpty()
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
