import { ApiProperty } from '@nestjs/swagger';
import { AccessGroupType, UserRole } from '../../frontend_shared/enum';

export class UserDto {
    @ApiProperty()
    uuid!: string;

    @ApiProperty()
    name!: string;

    @ApiProperty()
    avatarUrl!: string;
}

export class AccessGroupMemberDto extends UserDto {
    @ApiProperty()
    canEditGroup!: boolean;
}

export class AccessGroupDto {
    @ApiProperty()
    uuid!: string;

    @ApiProperty()
    name!: string;

    @ApiProperty()
    createdAt!: Date;

    @ApiProperty()
    updatedAt!: Date;

    @ApiProperty()
    type!: AccessGroupType;

    @ApiProperty()
    hidden!: boolean;

    @ApiProperty()
    creator!: AccessGroupMemberDto | null;

    @ApiProperty()
    memberships!: AccessGroupMemberDto[];
}

export class AccessGroupsDto {
    @ApiProperty()
    count!: number;

    @ApiProperty({
        type: [AccessGroupDto],
        description: 'List of access groups',
    })
    accessGroups!: AccessGroupDto[];
}

export class GroupMembershipDto {
    @ApiProperty()
    uuid!: string;

    @ApiProperty()
    createdAt!: Date;

    @ApiProperty()
    updatedAt!: Date;

    @ApiProperty()
    expirationDate?: Date;

    @ApiProperty()
    user!: UserDto;

    @ApiProperty()
    canEditGroup!: boolean;

    @ApiProperty({
        type: [AccessGroupDto, undefined],
        description: 'Access Group',
    })
    accessGroup?: AccessGroupDto;
}

export class CurrentAPIUserDto extends UserDto {
    @ApiProperty({
        type: [GroupMembershipDto],
        description: 'List of group memberships',
    })
    memberships!: GroupMembershipDto[];

    @ApiProperty()
    email!: string;

    @ApiProperty()
    role!: UserRole;
}

export class UsersDto {
    @ApiProperty({
        type: [UserDto],
        description: 'List of users',
    })
    users!: UserDto[];

    @ApiProperty()
    count!: number;
}
