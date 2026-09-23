import { CategoryEntity } from '@backend-common/entities/category/category.entity';
import { ProjectEntity } from '@backend-common/entities/project/project.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { extendedFaker } from '@backend-common/faker-extended';
import { setSeederFactory } from 'typeorm-extension';

export interface CategoryContext {
    project: ProjectEntity;
    creator: UserEntity;
    name?: string;
    description?: string;
}

setSeederFactory(CategoryEntity, (context: Partial<CategoryContext> = {}) => {
    const { project, creator, name, description } = context;

    if (!project) {
        throw new Error('Project is required');
    }

    if (!creator) {
        throw new Error('Creator is required');
    }

    const category = new CategoryEntity();
    category.name = name ?? extendedFaker.lorem.word();
    category.description = description ?? extendedFaker.lorem.sentence();
    category.project = project;
    category.creator = creator;

    return category;
});
