import { BaseEntity } from '@backend-common/entities/base-entity.entity';
import type { FileEntity } from '@backend-common/entities/file/file.entity';
import type { ProjectEntity } from '@backend-common/entities/project/project.entity';
import type { UserEntity } from '@backend-common/entities/user/user.entity';
import { Column, Entity, ManyToMany, ManyToOne, Unique } from 'typeorm';

@Entity({ name: 'category' })
@Unique('unique_category_name_per_project', ['name', 'project'])
export class CategoryEntity extends BaseEntity {
    @Column()
    name!: string;

    @ManyToOne(
        () =>
            require('@backend-common/entities/project/project.entity')
                .ProjectEntity as typeof ProjectEntity,
        (project) => project.categories,
        {
            onDelete: 'CASCADE',
        },
    )
    project?: ProjectEntity;

    @ManyToMany(
        () =>
            require('@backend-common/entities/file/file.entity')
                .FileEntity as typeof FileEntity,
        (file) => file.categories,
    )
    files?: FileEntity[];

    @ManyToOne(
        () =>
            require('@backend-common/entities/user/user.entity')
                .UserEntity as typeof UserEntity,
        (user) => user.categories,
    )
    creator?: UserEntity;
}
