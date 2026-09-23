import { AccessGroupRights } from '@kleinkram/shared';
import { IsNoValidUUID, IsValidName } from '@kleinkram/validation';
import {
    IsArray,
    IsBoolean,
    IsNotEmpty,
    IsOptional,
    IsString,
} from 'class-validator';

export class CreateProject {
    @IsString()
    @IsNotEmpty()
    @IsValidName()
    @IsNoValidUUID()
    name!: string;

    @IsNotEmpty()
    @IsString()
    description!: string;

    @IsOptional()
    @IsBoolean()
    autoConvert?: boolean;

    /** Uuids of the metadata types every mission of the project must set. */
    @IsArray()
    @IsOptional()
    requiredMetadataTypes?: string[];

    /**
     * Deprecated alias for `requiredMetadataTypes`. Ignored when
     * `requiredMetadataTypes` is given.
     */
    @IsArray()
    @IsOptional()
    requiredTags?: string[];

    @IsOptional()
    @IsArray()
    accessGroups?: (
        | { accessGroupUUID: string; rights: AccessGroupRights }
        | { userUuid: string; rights: AccessGroupRights }
    )[];

    @IsOptional()
    @IsArray()
    removedDefaultGroups?: string[];
}
