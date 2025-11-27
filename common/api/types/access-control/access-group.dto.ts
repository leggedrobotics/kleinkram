import { GroupMembershipDto } from '@common/api/types/access-control/group-membership.dto';
import { ProjectWithAccessRightsDto } from '@common/api/types/project/project-access.dto';
import { UserDto } from '@common/api/types/user/user.dto';
import { AccessGroupType } from '@common/frontend_shared/enum';
import { IsNotUndefined } from '@common/validation/is-not-undefined';
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
