import {
    Column,
    Entity,
    JoinTable,
    ManyToMany,
    ManyToOne,
    OneToMany,
} from 'typeorm';
import BaseEntity from '../base-entity.entity';
import { DataType } from '../../enum';
import Project from '../project/project.entity';
import Tag from '../tag/tag.entity';

@Entity()
export default class TagType extends BaseEntity {
    @Column()
    name: string;

    @Column()
    description: string;

    @Column()
    datatype: DataType;

    @ManyToMany(() => Project, (project) => project.requiredTags)
    @JoinTable()
    project: Project;

    @OneToMany(() => Tag, (tag) => tag.tagType)
    tags: Tag[];
}
