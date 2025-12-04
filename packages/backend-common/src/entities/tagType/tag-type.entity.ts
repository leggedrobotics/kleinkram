import BaseEntity from '@backend-common/entities/base-entity.entity';
import MetadataEntity from '@backend-common/entities/metadata/metadata.entity';
import ProjectEntity from '@backend-common/entities/project/project.entity';
import { DataType } from '@kleinkram/shared';
import { Column, Entity, JoinTable, ManyToMany, OneToMany } from 'typeorm';

@Entity({ name: 'tag_type' })
export default class TagTypeEntity extends BaseEntity {
    @Column()
    name!: string;

    @Column({ nullable: true })
    description?: string;

    @Column()
    datatype!: DataType;

    @ManyToMany(() => ProjectEntity, (project) => project.requiredTags)
    @JoinTable()
    project?: ProjectEntity;

    @OneToMany(() => MetadataEntity, (tag) => tag.tagType)
    tags?: MetadataEntity[];
}
