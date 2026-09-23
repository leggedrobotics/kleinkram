import { AccessGroupEntity } from '@backend-common/entities/auth/access-group.entity';
import { MetadataTypeEntity } from '@backend-common/entities/metadata/metadata-type.entity';
import { ProjectEntity } from '@backend-common/entities/project/project.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { extendedFaker } from '@backend-common/faker-extended';
import { setSeederFactory } from 'typeorm-extension';

export interface ProjectContext {
    name: string;
    creator: UserEntity;
    allUsers: UserEntity[];
    allAccessGroups: AccessGroupEntity[];
    metadataTypes: MetadataTypeEntity[];
}

setSeederFactory(ProjectEntity, (context: Partial<ProjectContext> = {}) => {
    const creator =
        context.creator ??
        extendedFaker.helpers.arrayElement(context.allUsers ?? []);

    // eslint-disable-next-line no-console
    console.assert(!!creator, 'No creator provided for project');

    const project = new ProjectEntity();
    project.uuid = extendedFaker.string.uuid();
    project.name = context.name ?? extendedFaker.project.name();
    project.creator = creator;
    project.description = extendedFaker.lorem.paragraph();

    if (context.metadataTypes === undefined)
        throw new Error('Metadata are undefined');

    project.requiredMetadataTypes = extendedFaker.helpers.arrayElements(
        context.metadataTypes,
        {
            min: 0,
            max: context.metadataTypes.length,
        },
    );

    return project;
});
