import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, ValidateNested } from 'class-validator';
import { GroupMembershipDto } from '../../../api/types/access-control/group-membership.dto';
import { UserDto } from '../../../api/types/user/user.dto';
import { UserRole } from '../../../frontend_shared/enum';

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
