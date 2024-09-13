import { RuntimeRequirements } from '@common/types';
import {
    IsBoolean,
    IsDefined,
    IsNotEmpty,
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

    @IsDefined()
    runtime_requirements: RuntimeRequirements;

    @IsBoolean()
    searchable: boolean;
}

export class UpdateTemplateDto extends CreateTemplateDto {
    @IsUUID()
    uuid: string;
}
