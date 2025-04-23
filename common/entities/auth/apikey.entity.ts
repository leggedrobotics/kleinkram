import { Column, Entity, Generated, ManyToOne, OneToOne } from 'typeorm';
import { AccessGroupRights, KeyTypes } from '../../frontend_shared/enum';
import Action from '../action/action.entity';
import BaseEntity from '../base-entity.entity';
import Mission from '../mission/mission.entity';
import User from '../user/user.entity';

@Entity()
export default class Apikey extends BaseEntity {
    @Column({ unique: true })
    @Generated('uuid')
    apikey!: string;

    @Column()
    key_type!: KeyTypes;

    @ManyToOne(() => Mission, (mission) => mission.api_keys, {
        onDelete: 'CASCADE',
        eager: true,
    })
    mission!: Mission;

    @OneToOne(() => Action, (action) => action.key, {
        onDelete: 'CASCADE',
        nullable: true,
    })
    action?: Action;

    @ManyToOne(() => User, (user) => user.api_keys, {
        onDelete: 'CASCADE',
    })
    user?: User;

    @Column()
    rights!: AccessGroupRights;
}
