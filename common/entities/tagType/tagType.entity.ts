import { Column, Entity, JoinTable, ManyToMany, ManyToOne } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import { DataType } from '../../enum';
import Project from '../project/project.entity';

@Entity()
export default class TagType extends BaseEntity {
    @Column()
    name: string;

    @Column()
    datatype: DataType;

    @ManyToMany(() => Project, (project) => project.requiredTags)
    @JoinTable()
    project: Project;
}
