import { BaseEntity } from '@backend-common/entities/base-entity.entity';
import { FileEntity } from '@backend-common/entities/file/file.entity';
import { ProjectEntity } from '@backend-common/entities/project/project.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { Column, Entity, Index, ManyToMany, ManyToOne } from 'typeorm';

@Index('unique_category_name_per_project', ['name', 'project'], {
    where: '"deletedAt" IS NULL',
    unique: true,
})
@Entity({ name: 'category' })
export class CategoryEntity extends BaseEntity {
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
