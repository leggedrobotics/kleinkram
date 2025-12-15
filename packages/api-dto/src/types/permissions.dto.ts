import { AccessGroupRights, UserRole } from '@kleinkram/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsUUID, ValidateNested } from 'class-validator';

export class ProjectPermissions {
    @ApiProperty()
    @IsUUID()
    uuid!: string;

    @ApiProperty()
    @IsEnum(AccessGroupRights)
    access!: AccessGroupRights;
}

export class MissionPermissions {
    @ApiProperty()
    @IsUUID()
    uuid!: string;

    @ApiProperty()
    @IsEnum(AccessGroupRights)
    access!: AccessGroupRights;
}

export class PermissionsDto {
    @ApiProperty()
    @IsEnum(UserRole)
    role!: UserRole;

    @ApiProperty()
    @IsEnum(AccessGroupRights)
    defaultPermission!: AccessGroupRights;

    @ApiProperty({
        type: () => [ProjectPermissions],
        description: 'List of projects and their access rights',
    })
    @ValidateNested()
    @Type(() => ProjectPermissions)
    projects!: ProjectPermissions[];

    @ApiProperty({
        type: () => [MissionPermissions],
        description: 'List of projects and their access rights',
    })
    @ValidateNested()
    @Type(() => ProjectPermissions)
    missions!: MissionPermissions[];
}
