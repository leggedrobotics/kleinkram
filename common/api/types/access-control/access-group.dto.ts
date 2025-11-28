import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsDate,
    IsEnum,
    IsOptional,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';
import { GroupMembershipDto } from '../../../api/types/access-control/group-membership.dto';
import { ProjectWithAccessRightsDto } from '../../../api/types/project/project-access.dto';
import { UserDto } from '../../../api/types/user/user.dto';
import { AccessGroupType } from '../../../frontend_shared/enum';
import { IsNotUndefined } from '../../../validation/is-not-undefined';

export class AccessGroupDto {
    @ApiProperty()
    @IsUUID()
    uuid!: string;

    @ApiProperty()
    @IsString()
    name!: string;

    @ApiProperty()
    @IsDate()
    createdAt!: Date;

    @ApiProperty()
    @IsDate()
    updatedAt!: Date;

    @ApiProperty()
    @IsEnum(AccessGroupType)
    type!: AccessGroupType;

    @ApiProperty()
    @IsBoolean()
    hidden!: boolean;

    @ApiProperty()
    @IsNotUndefined()
    @IsOptional()
    @ValidateNested()
    @Type(() => UserDto)
    creator!: UserDto | null;

    @ApiProperty({ type: () => [GroupMembershipDto] })
    @ValidateNested({ each: true })
    @Type(() => GroupMembershipDto)
    memberships!: GroupMembershipDto[];

    @ApiProperty()
    @ValidateNested({ each: true })
    @Type(() => ProjectWithAccessRightsDto)
    projectAccesses!: ProjectWithAccessRightsDto[];
}
