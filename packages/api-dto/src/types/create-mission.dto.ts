import { IsAtLeastOnePresent } from '@api-dto/metadata/update-mission-metadata.dto';
import { IsNoValidUUID, IsValidMissionName } from '@kleinkram/validation';
import {
    IsBoolean,
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';

@IsAtLeastOnePresent(['metadata', 'tags'])
export class CreateMission {
    @IsString()
    @IsNotEmpty()
    @IsValidMissionName()
    @IsNoValidUUID()
    name!: string;

    @IsUUID()
    projectUUID!: string;

    /** Metadata type uuid to value. */
    @IsOptional()
    @IsObject()
    metadata?: Record<string, string>;

    /** Deprecated alias for `metadata`. Ignored when `metadata` is given. */
    @IsOptional()
    @IsObject()
    tags?: Record<string, string>;

    /** Create the mission even if required metadata is missing. */
    @IsBoolean()
    @IsOptional()
    ignoreMissingMetadata?: boolean;

    /**
     * Deprecated alias for `ignoreMissingMetadata`. Ignored when
     * `ignoreMissingMetadata` is given.
     */
    @IsBoolean()
    @IsOptional()
    ignoreTags?: boolean;
}

export class UpdateMissionNameDto {
    @IsString()
    @IsNotEmpty()
    @IsValidMissionName()
    @IsNoValidUUID()
    name!: string;
}
