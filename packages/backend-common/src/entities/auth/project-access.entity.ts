import { BaseEntity } from '@backend-common/entities/base-entity.entity';
import { ProjectEntity } from '@backend-common/entities/project/project.entity';
import { Column, Entity, ManyToOne, Unique } from 'typeorm';
import { AccessGroupEntity } from './access-group.entity';

import { AccessGroupRights } from '@kleinkram/shared';

@Unique('no_duplicated_access_groups_per_project', ['accessGroup', 'project'])
@Entity({ name: 'project_access' })
export class ProjectAccessEntity extends BaseEntity {
    @Column({ type: 'enum', enum: AccessGroupRights })
    rights!: AccessGroupRights;

    @ManyToOne(() => AccessGroupEntity, (group) => group.project_accesses, {
        nullable: false,
    })
    accessGroup?: AccessGroupEntity;

    @ManyToOne(() => ProjectEntity, (project) => project.project_accesses, {
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        nullable: false,
    })
    project?: ProjectEntity;
}
