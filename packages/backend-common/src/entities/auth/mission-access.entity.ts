import type { AccessGroupEntity } from '@backend-common/entities/auth/accessgroup.entity';
import { BaseEntity } from '@backend-common/entities/base-entity.entity';
import type { MissionEntity } from '@backend-common/entities/mission/mission.entity';
import { Column, Entity, ManyToOne, Unique } from 'typeorm';

import { AccessGroupRights } from '@kleinkram/shared';

@Entity({ name: 'mission_access' })
@Unique('no_duplicated_access_groups_per_mission', ['accessGroup', 'mission'])
export class MissionAccessEntity extends BaseEntity {
    @Column({ type: 'enum', enum: AccessGroupRights })
    rights!: AccessGroupRights;

    @ManyToOne(
        () =>
            // eslint-disable-next-line @typescript-eslint/no-require-imports, unicorn/prefer-module
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            require('@backend-common/entities/auth/accessgroup.entity')
                .AccessGroupEntity as typeof AccessGroupEntity,
        (group) => group.project_accesses,
        {
            nullable: false,
        },
    )
    accessGroup?: AccessGroupEntity;

    @ManyToOne(
        () =>
            // eslint-disable-next-line @typescript-eslint/no-require-imports, unicorn/prefer-module
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            require('@backend-common/entities/mission/mission.entity')
                .MissionEntity as typeof MissionEntity,
        (mission) => mission.mission_accesses,
        {
            nullable: false,
        },
    )
    mission?: MissionEntity;
}
