import { CategoryEntity } from '@backend-common/entities/category/category.entity';
import { ProjectEntity } from '@backend-common/entities/project/project.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { extendedFaker } from '@backend-common/faker-extended';
import { type Faker } from '@faker-js/faker';
import { setSeederFactory } from 'typeorm-extension';

export interface CategoryContext {
    project: ProjectEntity;
    creator: UserEntity;
    name?: string;
}

setSeederFactory(
    CategoryEntity,
    (faker: Faker, context: Partial<CategoryContext> = {}) => {
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
    },
);
