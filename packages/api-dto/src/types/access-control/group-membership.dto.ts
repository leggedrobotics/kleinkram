import { AccessGroupDto } from '@api-dto/access-control/access-group.dto';
import { UserDto } from '@api-dto/user/user.dto';
import { IsNotUndefined } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsDate,
    IsOptional,
    IsUUID,
    ValidateIf,
    ValidateNested,
} from 'class-validator';

export class GroupMembershipDto {
    @ApiProperty()
    @IsUUID()
    uuid!: string;

    @ApiProperty()
    @IsDate()
    createdAt!: Date;

    @ValidateIf((_, value) => {
        // eslint-disable-next-line no-console
        console.log(value, typeof value);
        return true;
    })
    @ApiProperty()
    @IsDate()
    updatedAt!: Date;

    @ValidateIf((_, value) => {
        // eslint-disable-next-line no-console
        console.log(value, typeof value);
        return value !== null;
    })
    @ApiProperty()
    @IsDate()
    expirationDate!: Date | null;

    @ApiProperty({ type: () => UserDto })
    @ValidateNested()
    @Type(() => UserDto)
    user!: UserDto;

    @ApiProperty()
    @IsBoolean()
    canEditGroup!: boolean;

    @ApiProperty({
        type: () => AccessGroupDto,
        description: 'Access Group',
        nullable: true,
    })
    @IsNotUndefined()
    @IsOptional()
    @ValidateNested()
    @Type(() => AccessGroupDto)
    accessGroup!: AccessGroupDto | null;
}
