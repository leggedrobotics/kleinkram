import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AccessGroupRights } from '@common/enum';
import { IsValidName } from '../../validation/propertyDecorator';

export class CreateProject {
    @IsString()
    @IsNotEmpty()
    @IsValidName()
    name: string;

    @IsNotEmpty()
    @IsString()
    description: string;

    @IsArray()
    @IsOptional()
    requiredTags?: string[];

    @IsOptional()
    @IsArray()
    accessGroups?: (
        | { accessGroupUUID: string; rights: AccessGroupRights }
        | { userUUID: string; rights: AccessGroupRights }
    )[];
}
