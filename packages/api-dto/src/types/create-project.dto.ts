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
