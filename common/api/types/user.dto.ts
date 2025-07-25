import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsDate,
    IsEmail,
    IsEnum,
    IsOptional,
    IsString,
    IsUUID,
    registerDecorator,
    ValidateIf,
    ValidateNested,
    ValidationOptions,
} from 'class-validator';
import { AccessGroupType, UserRole } from '../../frontend_shared/enum';
import { ProjectWithAccessRightsDto } from './project/project-access.dto';

const IsNotUndefined = (validationOptions?: ValidationOptions) => {
    return function (object: object, propertyName: string): void {
        registerDecorator({
            name: 'isNotUndefined',
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions ?? {},
            validator: {
                validate(value: unknown): Promise<boolean> | boolean {
                    return value !== undefined;
                },
                defaultMessage(): string {
                    return '$property must not be undefined';
                },
            },
        });
    };
};

export class UserDto {
    @ApiProperty()
    @IsUUID()
    uuid!: string;

    @ApiProperty()
    @IsString()
    name!: string;

    @ApiProperty()
    @IsNotUndefined()
    @IsOptional()
    @IsString()
    avatarUrl!: string | null;
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
    @IsNotUndefined()
    @IsOptional()
    @ValidateNested()
    @Type(() => UserDto)
    creator!: UserDto | null;

    @ApiProperty()
    @ValidateNested({ each: true })
    @Type(() => GroupMembershipDto)
    memberships!: GroupMembershipDto[];

    @ApiProperty()
    @ValidateNested({ each: true })
    @Type(() => ProjectWithAccessRightsDto)
    projectAccesses!: ProjectWithAccessRightsDto[];
}

export class GroupMembershipDto {
    @ApiProperty()
    @IsUUID()
    uuid!: string;

    @ApiProperty()
    @IsDate()
    createdAt!: Date;

    @ValidateIf((_, value) => {
        console.log(value, typeof value);
        return true;
    })
    @ApiProperty()
    @IsDate()
    updatedAt!: Date;

    @ValidateIf((_, value) => {
        console.log(value, typeof value);
        return value !== null;
    })
    @ApiProperty()
    @IsDate()
    expirationDate!: Date | null;

    @ApiProperty()
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

export class CurrentAPIUserDto extends UserDto {
    @ApiProperty({
        type: () => [GroupMembershipDto],
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
        type: () => [UserDto],
        description: 'List of users',
    })
    users!: UserDto[];

    @ApiProperty()
    count!: number;
}
