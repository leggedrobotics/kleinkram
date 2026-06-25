/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { GroupMembershipDto } from '@api-dto/access-control/group-membership.dto';
import { ProjectWithAccessRightsDto } from '@api-dto/project/project-access.dto';
import { UserDto } from '@api-dto/user/user.dto';
import { AccessGroupType } from '@kleinkram/shared';
import { IsNotUndefined } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import {
    IsBoolean,
    IsDate,
    IsEnum,
    IsOptional,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';

@Expose()
export class AccessGroupDto {
    @ApiProperty()
    @IsUUID()
    @Expose()
    uuid!: string;

    @ApiProperty()
    @IsString()
    @Expose()
    name!: string;

    @ApiProperty()
    @IsDate()
    @Expose()
    createdAt!: Date;

    @ApiProperty()
    @IsDate()
    @Expose()
    updatedAt!: Date;

    @ApiProperty()
    @IsEnum(AccessGroupType)
    @Expose()
    type!: AccessGroupType;

    @ApiProperty()
    @IsBoolean()
    @Expose()
    hidden!: boolean;

    @ApiProperty()
    @IsNotUndefined()
    @IsOptional()
    @ValidateNested()
    @Type(() => UserDto)
    @Expose()
    @Transform(({ obj }) => obj.creator ?? null)
    creator!: UserDto | null;

    @ApiProperty({ type: () => [GroupMembershipDto] })
    @ValidateNested({ each: true })
    @Type(() => GroupMembershipDto)
    @Expose()
    @Transform(({ obj }) => obj.memberships ?? [])
    memberships!: GroupMembershipDto[];

    @ApiProperty()
    @ValidateNested({ each: true })
    @Type(() => ProjectWithAccessRightsDto)
    @Expose()
    @Transform(({ obj }) => obj.projectAccesses ?? [])
    projectAccesses!: ProjectWithAccessRightsDto[];

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @Expose()
    emailPattern?: string;
}
