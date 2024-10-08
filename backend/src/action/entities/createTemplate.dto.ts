import {
    IsBoolean,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';

export class CreateTemplateDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsOptional()
    command: string;

    @IsString()
    @IsNotEmpty()
    image: string;

    @IsNumber()
    cpuCores: number;

    @IsNumber()
    cpuMemory: number;

    @IsNumber()
    gpuMemory: number;

    @IsNumber()
    maxRuntime: number;

    @IsBoolean()
    searchable: boolean;
}

export class UpdateTemplateDto extends CreateTemplateDto {
    @IsUUID()
    uuid: string;
}
