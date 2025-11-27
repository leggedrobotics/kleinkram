import { GroupMembershipDto } from '@common/api/types/access-control/group-membership.dto';
import { UserDto } from '@common/api/types/user/user.dto';
import { UserRole } from '@common/frontend_shared/enum';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, ValidateNested } from 'class-validator';

export class CurrentAPIUserDto extends UserDto {
    @ApiProperty({
        type: () => [GroupMembershipDto],
        description: 'List of group memberships',
    })
    @ValidateNested({ each: true })
    @Type(() => GroupMembershipDto)
    memberships!: GroupMembershipDto[];

    @ApiProperty()
    @IsEnum(UserRole)
    role!: UserRole;
}
