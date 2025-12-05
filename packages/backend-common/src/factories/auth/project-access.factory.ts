import { AccessGroupEntity } from '@backend-common/entities/auth/accessgroup.entity';
import { ProjectAccessEntity } from '@backend-common/entities/auth/project-access.entity';
import { ProjectEntity } from '@backend-common/entities/project/project.entity';
import { faker } from '@faker-js/faker';
import { define } from 'typeorm-seeding';

import { AccessGroupRights } from '@kleinkram/shared';

export interface ProjectAccessFactoryContext {
    projects: ProjectEntity[];
    accessGroups: AccessGroupEntity[];
}

// @ts-ignore
define(ProjectAccessEntity, (_, context: ProjectAccessFactoryContext) => {
    const projectAccess = new ProjectAccessEntity();

    projectAccess.rights = faker.helpers.arrayElement([
        0, 10, 20, 30,
    ]) as AccessGroupRights;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (context?.projects) {
        projectAccess.project = faker.helpers.arrayElement(context.projects);
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (context?.accessGroups) {
        projectAccess.accessGroup = faker.helpers.arrayElement(
            context.accessGroups,
        );
    }
    return projectAccess;
});
