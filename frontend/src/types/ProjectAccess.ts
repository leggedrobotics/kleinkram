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
        deletedAt: Date | null,
    ) {
        super(uuid, createdAt, updatedAt, deletedAt);
        this.rights = rights;
        this.accessGroup = accessGroup;
        this.project = project;
    }
}
