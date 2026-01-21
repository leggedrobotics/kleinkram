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
    @Type(() => Number)
    access!: AccessGroupRights;
}

export class MissionPermissions {
    @ApiProperty()
    @IsUUID()
    uuid!: string;

    @ApiProperty()
    @IsEnum(AccessGroupRights)
    @Type(() => Number)
    access!: AccessGroupRights;
}

export class PermissionsDto {
    @ApiProperty()
    @IsEnum(UserRole)
    role!: UserRole;

    @ApiProperty()
    @IsEnum(AccessGroupRights)
    @Type(() => Number)
    defaultPermission!: AccessGroupRights;

    @ApiProperty({
        type: () => [ProjectPermissions],
        description: 'List of projects and their access rights',
    })
    @ValidateNested({ each: true })
    @Type(() => ProjectPermissions)
    projects!: ProjectPermissions[];

    @ApiProperty({
        type: () => [MissionPermissions],
        description: 'List of missions and their access rights',
    })
    @ValidateNested({ each: true })
    @Type(() => MissionPermissions)
    missions!: MissionPermissions[];
}
