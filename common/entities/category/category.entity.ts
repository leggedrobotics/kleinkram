import { Column, Entity, ManyToMany, ManyToOne, OneToMany } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import Project from '../project/project.entity';
import FileEntity from '../file/file.entity';
import User from '../user/user.entity';

@Entity()
export default class Category extends BaseEntity {
    @Column()
    name: string;

    @ManyToOne(() => Project, (project) => project.categories)
    project: Project;

    @ManyToMany(() => FileEntity, (file) => file.categories)
    files: FileEntity[];

    @ManyToOne(() => User, (user) => user.categories)
    creator: User;
}
