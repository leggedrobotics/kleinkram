import { ApiProperty } from '@nestjs/swagger';
import { AccessGroupRights, UserRole } from '../../frontend_shared/enum';
import { ProjectAccessDto } from './Project.dto';

export class ProjectPermissions {
    @ApiProperty()
    uuid!: string;

    @ApiProperty()
    access!: AccessGroupRights;
}

export class MissionPermissions {
    @ApiProperty()
    uuid!: string;

    @ApiProperty()
    access!: AccessGroupRights;
}

export class PermissionsDto {
    @ApiProperty()
    role!: UserRole;

    @ApiProperty()
    default_permission!: AccessGroupRights;

    @ApiProperty({
        type: [ProjectPermissions],
        description: 'List of projects and their access rights',
    })
    projects!: ProjectAccessDto[];

    @ApiProperty({
        type: [MissionPermissions],
        description: 'List of projects and their access rights',
    })
    missions!: MissionPermissions[];
}
