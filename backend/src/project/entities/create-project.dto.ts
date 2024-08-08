import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AccessGroupRights } from '@common/enum';

export class CreateProject {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsNotEmpty()
    @IsString()
    description: string;

    @IsArray()
    requiredTags?: string[];

    @IsOptional()
    @IsArray()
    accessGroups?: (
        | { accessGroupUUID: string; rights: AccessGroupRights }
        | { userUUID: string; rights: AccessGroupRights }
    )[];
}
