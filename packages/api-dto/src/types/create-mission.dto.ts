import { IsNoValidUUID, IsValidMissionName } from '@kleinkram/validation';
import {
    IsBoolean,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';

export class CreateMission {
    @IsString()
    @IsNotEmpty()
    @IsValidMissionName()
    @IsNoValidUUID()
    name!: string;

    @IsUUID()
    projectUUID!: string;

    @IsNotEmpty()
    tags!: Record<string, string>;

    @IsBoolean()
    @IsOptional()
    ignoreTags!: boolean;
}

export class UpdateMissionNameDto {
    @IsString()
    @IsNotEmpty()
    @IsValidMissionName()
    @IsNoValidUUID()
    name!: string;
}
