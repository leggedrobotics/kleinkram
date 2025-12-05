import type { ActionEntity } from '@backend-common/entities/action/action.entity';
import { BaseEntity } from '@backend-common/entities/base-entity.entity';
import type { MissionEntity } from '@backend-common/entities/mission/mission.entity';
import type { UserEntity } from '@backend-common/entities/user/user.entity';
import { AccessGroupRights, KeyTypes } from '@kleinkram/shared';
import { Column, Entity, Generated, ManyToOne, OneToOne } from 'typeorm';

@Entity({ name: 'apikey' })
export class ApikeyEntity extends BaseEntity {
    @Column({ unique: true })
    @Generated('uuid')
    apikey!: string;

    @Column({ type: 'enum', enum: KeyTypes })
    key_type!: KeyTypes;

    @ManyToOne(
        () =>
            require('@backend-common/entities/mission/mission.entity')
                .MissionEntity as typeof MissionEntity,
        (mission) => mission.api_keys,
        {
            onDelete: 'CASCADE',
            eager: true,
        },
    )
    mission!: MissionEntity;

    @OneToOne(
        () =>
            require('@backend-common/entities/action/action.entity')
                .ActionEntity as typeof ActionEntity,
        (action) => action.key,
        {
            onDelete: 'CASCADE',
            nullable: true,
        },
    )
    action?: ActionEntity;

    @ManyToOne(
        () =>
            require('@backend-common/entities/user/user.entity')
                .UserEntity as typeof UserEntity,
        (user) => user.api_keys,
        {
            onDelete: 'CASCADE',
        },
    )
    user?: UserEntity;

    @Column({ type: 'enum', enum: AccessGroupRights })
    rights!: AccessGroupRights;
}
