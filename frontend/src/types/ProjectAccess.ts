import { Project } from 'src/types/Project';
import { BaseEntity } from 'src/types/BaseEntity';
import { AccessGroupRights } from 'src/enums/ACCESS_RIGHTS';
import { AccessGroup } from 'src/types/AccessGroup';

export class ProjectAccess extends BaseEntity {
    rights: AccessGroupRights;
    accessGroup?: AccessGroup;
    project?: Project;

    private constructor(
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

    static fromAPIResponse(response: any): ProjectAccess {
        const accessGroup = response.accessGroup
            ? AccessGroup.fromAPIResponse(response.accessGroup)
            : undefined;
        const project = response.project
            ? Project.fromAPIResponse(response.project)
            : undefined;
        return new ProjectAccess(
            response.uuid,
            response.rights,
            accessGroup,
            project,
            new Date(response.createdAt),
            new Date(response.updatedAt),
        );
    }
}
