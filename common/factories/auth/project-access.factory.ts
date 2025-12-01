import { faker } from '@faker-js/faker';
import { define } from 'typeorm-seeding';
import AccessGroupEntity from '../../entities/auth/accessgroup.entity';
import ProjectAccessEntity from '../../entities/auth/project-access.entity';
import ProjectEntity from '../../entities/project/project.entity';

import { AccessGroupRights } from '../../frontend_shared/enum';

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

    if (context?.projects) {
        projectAccess.project = faker.helpers.arrayElement(context.projects);
    }
    if (context?.accessGroups) {
        projectAccess.accessGroup = faker.helpers.arrayElement(
            context.accessGroups,
        );
    }
    return projectAccess;
});
