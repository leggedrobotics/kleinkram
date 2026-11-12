import { BaseEntity } from '@backend-common/entities/base-entity.entity';
import { MetadataEntity } from '@backend-common/entities/metadata/metadata.entity';
import { ProjectEntity } from '@backend-common/entities/project/project.entity';
import { DataType } from '@kleinkram/shared';
import { Column, Entity, JoinTable, ManyToMany, OneToMany } from 'typeorm';

@Entity({ name: 'metadata_type' })
export class MetadataTypeEntity extends BaseEntity {
    @Column()
    name!: string;

    @Column({ nullable: true })
    description?: string;

    @Column({ type: 'enum', enum: DataType })
    datatype!: DataType;

    @ManyToMany(
        () => ProjectEntity,
        (project: ProjectEntity) => project.requiredMetadataTypes,
    )
    @JoinTable()
    projects?: ProjectEntity[];

    @OneToMany(
        () => MetadataEntity,
        (metadata: MetadataEntity) => metadata.metadataType,
    )
    metadata?: MetadataEntity[];
}
