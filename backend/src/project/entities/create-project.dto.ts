import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IsNoValidUUID, IsValidName } from '../../validation/propertyDecorator';

import { AccessGroupRights } from '@common/frontend_shared/enum';

export class CreateProject {
    @IsString()
    @IsNotEmpty()
    @IsValidName()
    @IsNoValidUUID()
    name!: string;

    @IsNotEmpty()
    @IsString()
    description!: string;

    @IsArray()
    @IsOptional()
    requiredTags?: string[];

    @IsOptional()
    @IsArray()
    accessGroups?: (
        | { accessGroupUUID: string; rights: AccessGroupRights }
        | { userUUID: string; rights: AccessGroupRights }
    )[];

    @IsOptional()
    @IsArray()
    removedDefaultGroups?: string[];
}
