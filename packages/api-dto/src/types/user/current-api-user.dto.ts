import { GroupMembershipDto } from '@api-dto/access-control/group-membership.dto';
import { UserDto } from '@api-dto/user/user.dto';
import { UserRole } from '@kleinkram/shared';
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
