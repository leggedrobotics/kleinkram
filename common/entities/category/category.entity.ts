import { Column, Entity, ManyToMany, ManyToOne, Unique } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import FileEntity from '../file/file.entity';
import Project from '../project/project.entity';
import User from '../user/user.entity';

@Entity()
@Unique('unique_category_name_per_project', ['name', 'project'])
export default class Category extends BaseEntity {
    @Column()
    name!: string;

    @ManyToOne(() => Project, (project) => project.categories)
    project?: Project;

    @ManyToMany(() => FileEntity, (file) => file.categories)
    files?: FileEntity[];

    @ManyToOne(() => User, (user) => user.categories)
    creator?: User;
}
