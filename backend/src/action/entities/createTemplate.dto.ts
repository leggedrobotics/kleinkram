import {
    IsBoolean,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';

import { AccessGroupRights } from '@common/frontend_shared/enum';

export class CreateTemplateDto {
    @IsString()
    @IsNotEmpty()
    name!: string;

    @IsString()
    @IsOptional()
    command?: string;

    @IsString()
    @IsNotEmpty()
    image!: string;

    @IsNumber()
    cpuCores!: number;

    @IsNumber()
    cpuMemory!: number;

    @IsNumber()
    gpuMemory!: number;

    @IsNumber()
    maxRuntime!: number;

    @IsBoolean()
    searchable!: boolean;

    @IsString()
    @IsOptional()
    entrypoint?: string;

    @IsEnum(AccessGroupRights)
    accessRights!: AccessGroupRights;
}

export class UpdateTemplateDto extends CreateTemplateDto {
    @IsUUID()
    uuid!: string;
}
