import { faker } from '@faker-js/faker';
import { define } from 'typeorm-seeding';
import AccessGroup from '../../entities/auth/accessgroup.entity';
import ProjectAccess from '../../entities/auth/project-access.entity';
import Project from '../../entities/project/project.entity';

import { AccessGroupRights } from '../../frontend_shared/enum';

export interface ProjectAccessFactoryContext {
    projects: Project[];
    accessGroups: AccessGroup[];
}

// @ts-ignore
define(ProjectAccess, (_, context: ProjectAccessFactoryContext) => {
    const projectAccess = new ProjectAccess();

    projectAccess.rights = faker.helpers.arrayElement([
        0, 10, 20, 30,
    ]) as AccessGroupRights;

    projectAccess.project = faker.helpers.arrayElement(context.projects);
    projectAccess.accessGroup = faker.helpers.arrayElement(
        context.accessGroups,
    );
    return projectAccess;
});
