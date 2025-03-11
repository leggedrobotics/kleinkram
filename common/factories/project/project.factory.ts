import { define } from 'typeorm-seeding';
import Project from '../../entities/project/project.entity';
import User from '../../entities/user/user.entity';
import { extendedFaker } from '../../faker-extended';
import AccessGroup from '../../entities/auth/accessgroup.entity';
import { faker } from '@faker-js/faker';
import TagType from '../../entities/tagType/tag-type.entity';

export interface ProjectContext {
    name: string;
    creator: User;
    allUsers: User[];
    allAccessGroups: AccessGroup[];
    tagTypes: TagType[];
}

define(Project, (_, context: Partial<ProjectContext> = {}) => {
    const creator =
        context.creator || faker.helpers.arrayElement(context.allUsers ?? []);
    console.assert(creator, 'No creator provided for project');

    const project = new Project();
    project.uuid = extendedFaker.string.uuid();
    project.name = context.name || extendedFaker.project.name();
    project.creator = creator;
    project.description = extendedFaker.lorem.paragraph();

    if (context.tagTypes === undefined)
        throw new Error('Metadata are undefined');

    project.requiredTags = extendedFaker.helpers.arrayElements(
        context.tagTypes,
        {
            min: 0,
            max: context.tagTypes.length,
        },
    );

    return project;
});
