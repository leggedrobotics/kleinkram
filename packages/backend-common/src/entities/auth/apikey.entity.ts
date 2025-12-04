import ActionEntity from '@backend-common/entities/action/action.entity';
import BaseEntity from '@backend-common/entities/base-entity.entity';
import MissionEntity from '@backend-common/entities/mission/mission.entity';
import UserEntity from '@backend-common/entities/user/user.entity';
import { AccessGroupRights, KeyTypes } from '@kleinkram/shared';
import { Column, Entity, Generated, ManyToOne, OneToOne } from 'typeorm';

@Entity({ name: 'apikey' })
export default class ApikeyEntity extends BaseEntity {
    @Column({ unique: true })
    @Generated('uuid')
    apikey!: string;

    @Column()
    key_type!: KeyTypes;

    @ManyToOne(() => MissionEntity, (mission) => mission.api_keys, {
        onDelete: 'CASCADE',
        eager: true,
    })
    mission!: MissionEntity;

    @OneToOne(() => ActionEntity, (action) => action.key, {
        onDelete: 'CASCADE',
        nullable: true,
    })
    action?: ActionEntity;

    @ManyToOne(() => UserEntity, (user) => user.api_keys, {
        onDelete: 'CASCADE',
    })
    user?: UserEntity;

    @Column()
    rights!: AccessGroupRights;
}
