import { AccessGroupEntity } from '@backend-common/entities/auth/access-group.entity';
import { ProjectEntity } from '@backend-common/entities/project/project.entity';
import { TagTypeEntity } from '@backend-common/entities/tagType/tag-type.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { extendedFaker } from '@backend-common/faker-extended';
import { faker } from '@faker-js/faker';
import { define } from 'typeorm-seeding';

export interface ProjectContext {
    name: string;
    creator: UserEntity;
    allUsers: UserEntity[];
    allAccessGroups: AccessGroupEntity[];
    tagTypes: TagTypeEntity[];
}

define(ProjectEntity, (_, context: Partial<ProjectContext> = {}) => {
    const creator =
        context.creator ?? faker.helpers.arrayElement(context.allUsers ?? []);

    // eslint-disable-next-line no-console
    console.assert(creator, 'No creator provided for project');

    const project = new ProjectEntity();
    project.uuid = extendedFaker.string.uuid();
    project.name = context.name ?? extendedFaker.project.name();
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
