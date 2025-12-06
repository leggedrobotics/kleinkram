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
            // eslint-disable-next-line @typescript-eslint/no-require-imports, unicorn/prefer-module
            require('@backend-common/entities/project/project.entity')
                .ProjectEntity as typeof ProjectEntity, // eslint-disable-line @typescript-eslint/no-unsafe-member-access
        (project) => project.categories,
        {
            onDelete: 'CASCADE',
        },
    )
    project?: ProjectEntity;

    @ManyToMany(
        () =>
            // eslint-disable-next-line @typescript-eslint/no-require-imports, unicorn/prefer-module
            require('@backend-common/entities/file/file.entity')
                .FileEntity as typeof FileEntity, // eslint-disable-line @typescript-eslint/no-unsafe-member-access
        (file) => file.categories,
    )
    files?: FileEntity[];

    @ManyToOne(
        () =>
            // eslint-disable-next-line @typescript-eslint/no-require-imports, unicorn/prefer-module
            require('@backend-common/entities/user/user.entity')
                .UserEntity as typeof UserEntity, // eslint-disable-line @typescript-eslint/no-unsafe-member-access
        (user) => user.categories,
    )
    creator?: UserEntity;
}
