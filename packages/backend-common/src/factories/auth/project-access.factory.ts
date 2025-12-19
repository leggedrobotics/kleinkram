import { AccessGroupEntity } from '@backend-common/entities/auth/access-group.entity';
import { ProjectAccessEntity } from '@backend-common/entities/auth/project-access.entity';
import { ProjectEntity } from '@backend-common/entities/project/project.entity';
import { type Faker } from '@faker-js/faker';
import { setSeederFactory } from 'typeorm-extension';

import { AccessGroupRights } from '@kleinkram/shared';

export interface ProjectAccessFactoryContext {
    project?: ProjectEntity;
    accessGroup?: AccessGroupEntity;
    projects?: ProjectEntity[];
    accessGroups?: AccessGroupEntity[];
}

setSeederFactory(
    ProjectAccessEntity,
    (faker: Faker, context: Partial<ProjectAccessFactoryContext> = {}) => {
        const projectAccess = new ProjectAccessEntity();

        projectAccess.rights = faker.helpers.arrayElement([
            0, 10, 20, 30,
        ]) as AccessGroupRights;

        if (context.project) {
            projectAccess.project = context.project;
        } else if (context.projects) {
            projectAccess.project = faker.helpers.arrayElement(
                context.projects,
            );
        }

        if (context.accessGroup) {
            projectAccess.accessGroup = context.accessGroup;
        } else if (context.accessGroups) {
            projectAccess.accessGroup = faker.helpers.arrayElement(
                context.accessGroups,
            );
        }
        return projectAccess;
    },
);
