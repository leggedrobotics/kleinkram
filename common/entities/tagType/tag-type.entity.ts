import { Column, Entity, JoinTable, ManyToMany, OneToMany } from 'typeorm';
import { DataType } from '../../frontend_shared/enum';
import BaseEntity from '../base-entity.entity';
import Project from '../project/project.entity';
import Tag from '../tag/tag.entity';

@Entity()
export default class TagType extends BaseEntity {
    @Column()
    name!: string;

    @Column({ nullable: true })
    description?: string;

    @Column()
    datatype!: DataType;

    @ManyToMany(() => Project, (project) => project.requiredTags)
    @JoinTable()
    project?: Project;

    @OneToMany(() => Tag, (tag) => tag.tagType)
    tags?: Tag[];
}
