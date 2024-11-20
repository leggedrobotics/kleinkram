import { define } from 'typeorm-seeding';
import AccessGroup from '../../entities/auth/accessgroup.entity';
import { faker } from '@faker-js/faker';
import Project from '../../entities/project/project.entity';
import ProjectAccess from '../../entities/auth/project_access.entity';

import { AccessGroupRights } from '../../frontend_shared/enum';

export type ProjectAccessFactoryContext = {
    projects: Project[];
    accessGroups: AccessGroup[];
};

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
