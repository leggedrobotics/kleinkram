import { AccessGroupEntity } from '@backend-common/entities/auth/access-group.entity';
import { ProjectAccessEntity } from '@backend-common/entities/auth/project-access.entity';
import { ProjectEntity } from '@backend-common/entities/project/project.entity';
import { extendedFaker } from '@backend-common/faker-extended';
import { setSeederFactory } from 'typeorm-extension';

export interface ProjectAccessFactoryContext {
    project?: ProjectEntity;
    accessGroup?: AccessGroupEntity;
    projects?: ProjectEntity[];
    accessGroups?: AccessGroupEntity[];
}

setSeederFactory(
    ProjectAccessEntity,
    (context: Partial<ProjectAccessFactoryContext> = {}) => {
        const projectAccess = new ProjectAccessEntity();

        projectAccess.rights = extendedFaker.helpers.arrayElement([
            0, 10, 20, 30,
        ]);

        if (context.project) {
            projectAccess.project = context.project;
        } else if (context.projects) {
            projectAccess.project = extendedFaker.helpers.arrayElement(
                context.projects,
            );
        }

        if (context.accessGroup) {
            projectAccess.accessGroup = context.accessGroup;
        } else if (context.accessGroups) {
            projectAccess.accessGroup = extendedFaker.helpers.arrayElement(
                context.accessGroups,
            );
        }
        return projectAccess;
    },
);
