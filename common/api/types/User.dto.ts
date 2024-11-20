import { ApiProperty } from '@nestjs/swagger';
import { AccessGroupType } from '../../frontend_shared/enum';

export class AccessGroupDto {
    @ApiProperty()
    uuid: string;

    @ApiProperty()
    name: string;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;

    @ApiProperty()
    type: AccessGroupType;

    @ApiProperty()
    hidden: boolean;
}

export class GroupMembershipDto {
    @ApiProperty()
    uuid: string;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;

    @ApiProperty()
    expirationDate: Date | null;

    @ApiProperty()
    canEditGroup: boolean;

    @ApiProperty({
        type: AccessGroupDto || undefined,
        description: 'Access Group',
    })
    accessGroup?: AccessGroupDto;
}

export class UserDto {
    @ApiProperty()
    uuid: string;

    @ApiProperty()
    name: string;

    @ApiProperty()
    email: string;

    @ApiProperty()
    role: string;

    @ApiProperty()
    avatarUrl: string;
}

export class CurrentAPIUserDto extends UserDto {
    @ApiProperty({
        type: [GroupMembershipDto],
        description: 'List of group memberships',
    })
    memberships: GroupMembershipDto[];
}
