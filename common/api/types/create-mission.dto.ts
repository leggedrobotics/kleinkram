import {
    IsBoolean,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';
import {
    IsNoValidUUID,
    IsValidMissionName,
} from '../../../backend/src/validation/property-decorator';

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
