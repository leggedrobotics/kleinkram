import { define } from 'typeorm-seeding';
import Project from '../../entities/project/project.entity';
import User from '../../entities/user/user.entity';
import { extendedFaker } from '../../faker_extended';
import AccessGroup from '../../entities/auth/accessgroup.entity';
import { faker } from '@faker-js/faker';
import TagType from '../../entities/tagType/tagType.entity';

export type ProjectContext = {
    name: string;
    creator: User;
    all_users: User[];
    all_access_groups: AccessGroup[];
    tagTypes: TagType[];
};

define(Project, (_, context: Partial<ProjectContext> = {}) => {
    const creator =
        context.creator || faker.helpers.arrayElement(context.all_users);
    console.assert(creator, 'No creator provided for project');

    const project = new Project();
    project.uuid = extendedFaker.string.uuid();
    project.name = context.name || `${extendedFaker.project.name()}`;
    project.creator = creator;
    project.description = extendedFaker.lorem.paragraph();

    project.requiredTags = extendedFaker.helpers.arrayElements(
        context.tagTypes,
        {
            min: 0,
            max: context.tagTypes.length,
        },
    );

    return project;
});
