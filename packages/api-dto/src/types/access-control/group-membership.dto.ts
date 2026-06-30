/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unnecessary-condition */
import { AccessGroupDto } from '@api-dto/access-control/access-group.dto';
import { UserDto } from '@api-dto/user/user.dto';
import { IsNotUndefined } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import {
    IsBoolean,
    IsDate,
    IsOptional,
    IsUUID,
    ValidateIf,
    ValidateNested,
} from 'class-validator';

@Expose()
export class GroupMembershipDto {
    @ApiProperty()
    @IsUUID()
    @Expose()
    uuid!: string;

    @ApiProperty()
    @IsDate()
    @Expose()
    createdAt!: Date;

    @ValidateIf((_, value) => {
        // eslint-disable-next-line no-console
        console.log(value, typeof value);
        return true;
    })
    @ApiProperty()
    @IsDate()
    @Expose()
    updatedAt!: Date;

    @ValidateIf((_, value) => {
        // eslint-disable-next-line no-console
        console.log(value, typeof value);
        return value !== null;
    })
    @ApiProperty()
    @IsDate()
    @Expose()
    @Transform(({ obj }) => obj.expirationDate ?? null)
    expirationDate!: Date | null;

    @ApiProperty({ type: () => UserDto })
    @ValidateNested()
    @Type(() => UserDto)
    @Expose()
    user!: UserDto;

    @ApiProperty()
    @IsBoolean()
    @Expose()
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
    @Expose()
    @Transform(({ obj, options }) => {
        // Check if accessGroup should be included
        if (
            options?.groups?.includes('includeAccessGroup') &&
            obj.accessGroup
        ) {
            return obj.accessGroup;
        }
        return null;
    })
    accessGroup!: AccessGroupDto | null;
}
