import BaseEntity from '@backend-common/entities/base-entity.entity';
import FileEntity from '@backend-common/entities/file/file.entity';
import ProjectEntity from '@backend-common/entities/project/project.entity';
import UserEntity from '@backend-common/entities/user/user.entity';
import { Column, Entity, ManyToMany, ManyToOne, Unique } from 'typeorm';

@Entity({ name: 'category' })
@Unique('unique_category_name_per_project', ['name', 'project'])
export default class CategoryEntity extends BaseEntity {
    @Column()
    name!: string;

    @ManyToOne(() => ProjectEntity, (project) => project.categories, {
        onDelete: 'CASCADE',
    })
    project?: ProjectEntity;

    @ManyToMany(() => FileEntity, (file) => file.categories)
    files?: FileEntity[];

    @ManyToOne(() => UserEntity, (user) => user.categories)
    creator?: UserEntity;
}
