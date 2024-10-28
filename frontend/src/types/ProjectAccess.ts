import { Project } from 'src/types/Project';
import { BaseEntity } from 'src/types/BaseEntity';
import { AccessGroupRights } from 'src/enums/ACCESS_RIGHTS';
import { AccessGroup } from 'src/types/AccessGroup';

export class ProjectAccess extends BaseEntity {
    rights: AccessGroupRights;
    accessGroup?: AccessGroup;
    project?: Project;

    constructor(
        uuid: string,
        rights: AccessGroupRights,
        accessGroup: AccessGroup | undefined,
        project: Project | undefined,
        createdAt: Date,
        updatedAt: Date,
    ) {
        super(uuid, createdAt, updatedAt);
        this.rights = rights;
        this.accessGroup = accessGroup;
        this.project = project;
    }
}
