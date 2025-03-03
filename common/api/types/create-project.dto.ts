import {
    IsArray,
    IsBoolean,
    IsNotEmpty,
    IsOptional,
    IsString,
} from 'class-validator';
import {
    IsNoValidUUID,
    IsValidName,
} from '../../../backend/src/validation/property-decorator';
import { AccessGroupRights } from '../../frontend_shared/enum';

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
        | { userUUID: string; rights: AccessGroupRights }
    )[];

    @IsOptional()
    @IsArray()
    removedDefaultGroups?: string[];
}
