import { define } from 'typeorm-seeding';
import CategoryEntity from '../../entities/category/category.entity';
import ProjectEntity from '../../entities/project/project.entity';
import UserEntity from '../../entities/user/user.entity';
import { extendedFaker } from '../../faker-extended';

export interface CategoryContext {
    project: ProjectEntity;
    creator: UserEntity;
    name?: string;
}

define(CategoryEntity, (_, context: Partial<CategoryContext> = {}) => {
    const { project, creator, name } = context;

    if (!project) {
        throw new Error('Project is required');
    }

    if (!creator) {
        throw new Error('Creator is required');
    }

    const category = new CategoryEntity();
    category.name = name ?? extendedFaker.lorem.word();
    category.project = project;
    category.creator = creator;

    return category;
});
