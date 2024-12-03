import { ApiProperty } from '@nestjs/swagger';
import { AccessGroupType, UserRole } from '../../frontend_shared/enum';
import {
    IsBoolean,
    IsDate,
    IsEmail,
    IsEnum,
    IsString,
    IsUrl,
    IsUUID,
    registerDecorator,
    ValidateNested,
    ValidationOptions,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UserDto {
    @ApiProperty()
    @IsUUID()
    uuid!: string;

    @ApiProperty()
    @IsString()
    name!: string;

    @ApiProperty()
    @IsUrl()
    avatarUrl!: string;
}

export class AccessGroupMemberDto extends UserDto {
    @ApiProperty()
    @IsBoolean()
    canEditGroup!: boolean;
}

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
    @ValidateNested()
    creator!: AccessGroupMemberDto | null;

    @ApiProperty()
    @ValidateNested({ each: true })
    @Type(() => AccessGroupMemberDto)
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

const IsDateOrNull = (validationOptions?: ValidationOptions) => {
    return function (object: object, propertyName: string): void {
        registerDecorator({
            name: 'isDateOrNull',
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions ?? {},
            validator: {
                validate(value: unknown): Promise<boolean> | boolean {
                    return value === null || value instanceof Date;
                },
                defaultMessage(): string {
                    return '$property must be a Date or null';
                },
            },
        });
    };
};

export class GroupMembershipDto {
    @ApiProperty()
    @IsUUID()
    uuid!: string;

    @ApiProperty()
    @IsDate()
    createdAt!: Date;

    @ApiProperty()
    @IsDate()
    updatedAt!: Date;

    @ApiProperty()
    @IsDateOrNull()
    expirationDate!: Date | null;

    @ApiProperty()
    @ValidateNested()
    @Type(() => UserDto)
    user!: UserDto;

    @ApiProperty()
    @IsBoolean()
    canEditGroup!: boolean;

    @ApiProperty({
        type: [AccessGroupDto, undefined],
        description: 'Access Group',
    })
    @ValidateNested()
    @Type(() => AccessGroupDto)
    accessGroup?: AccessGroupDto;
}

export class CurrentAPIUserDto extends UserDto {
    @ApiProperty({
        type: [GroupMembershipDto],
        description: 'List of group memberships',
    })
    @ValidateNested({ each: true })
    @Type(() => GroupMembershipDto)
    memberships!: GroupMembershipDto[];

    @ApiProperty()
    @IsEmail()
    email!: string;

    @ApiProperty()
    @IsEnum(UserRole)
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
