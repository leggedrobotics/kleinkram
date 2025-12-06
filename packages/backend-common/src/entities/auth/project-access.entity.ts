import type { AccessGroupEntity } from '@backend-common/entities/auth/accessgroup.entity';
import { BaseEntity } from '@backend-common/entities/base-entity.entity';
import type { ProjectEntity } from '@backend-common/entities/project/project.entity';
import { Column, Entity, ManyToOne, Unique } from 'typeorm';

import { AccessGroupRights } from '@kleinkram/shared';

@Unique('no_duplicated_access_groups_per_project', ['accessGroup', 'project'])
@Entity({ name: 'project_access' })
export class ProjectAccessEntity extends BaseEntity {
    @Column({ type: 'enum', enum: AccessGroupRights })
    rights!: AccessGroupRights;

    @ManyToOne(
        () =>
            // eslint-disable-next-line @typescript-eslint/no-require-imports, unicorn/prefer-module
            require('@backend-common/entities/auth/accessgroup.entity')
                .AccessGroupEntity as typeof AccessGroupEntity, // eslint-disable-line @typescript-eslint/no-unsafe-member-access
        (group) => group.project_accesses,
        {
            nullable: false,
        },
    )
    accessGroup?: AccessGroupEntity;

    @ManyToOne(
        () =>
            // eslint-disable-next-line @typescript-eslint/no-require-imports, unicorn/prefer-module
            require('@backend-common/entities/project/project.entity')
                .ProjectEntity as typeof ProjectEntity, // eslint-disable-line @typescript-eslint/no-unsafe-member-access
        (project) => project.project_accesses,
        {
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
            nullable: false,
        },
    )
    project?: ProjectEntity;
}
