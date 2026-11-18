import { AccessGroupRights } from '@kleinkram/shared';
import { IsValidName } from '@kleinkram/validation';
import {
    IsArray,
    IsBoolean,
    IsNotEmpty,
    IsOptional,
    IsString,
} from 'class-validator';

/** Fields shared by creating and updating a project, everything but the name. */
export class ProjectFieldsDto {
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

export class CreateProject extends ProjectFieldsDto {
    @IsString()
    @IsNotEmpty()
    @IsValidName('Project name')
    name!: string;
}

/**
 * The name is checked by the server only if it changes, so a project named
 * before the naming rules can still be edited without renaming it.
 */
export class UpdateProject extends ProjectFieldsDto {
    @IsString()
    @IsNotEmpty()
    name!: string;
}
