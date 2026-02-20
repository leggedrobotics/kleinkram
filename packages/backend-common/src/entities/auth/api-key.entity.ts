import { ActionEntity } from '@backend-common/entities/action/action.entity';
import { BaseEntity } from '@backend-common/entities/base-entity.entity';
import { MissionEntity } from '@backend-common/entities/mission/mission.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { AccessGroupRights, KeyTypes } from '@kleinkram/shared';
import { Column, Entity, Generated, Index, ManyToOne, OneToOne } from 'typeorm';

@Index('unique_apikey_active', ['apikey'], {
    where: '"deletedAt" IS NULL',
    unique: true,
})
@Entity({ name: 'apikey' })
export class ApiKeyEntity extends BaseEntity {
    @Column()
    @Generated('uuid')
    apikey!: string;

    @Column({ type: 'enum', enum: KeyTypes })

    // eslint-disable-next-line @typescript-eslint/naming-convention
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

    @Column({ type: 'enum', enum: AccessGroupRights })
    rights!: AccessGroupRights;
}
