import { GroupMembershipDto } from '@api-dto/access-control/group-membership.dto';
import { ProjectWithAccessRightsDto } from '@api-dto/project/project-access.dto';
import { UserDto } from '@api-dto/user/user.dto';
import { AccessGroupType } from '@kleinkram/shared';
import { IsNotUndefined } from '@kleinkram/validation';
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
