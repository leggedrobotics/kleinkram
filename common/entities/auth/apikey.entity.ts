import { Column, Entity, Generated, ManyToOne, OneToOne } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import { KeyTypes } from '../../enum';
import Mission from '../mission/mission.entity';
import Action from '../action/action.entity';
import User from '../user/user.entity';

@Entity()
export default class Apikey extends BaseEntity {
    @Column({ unique: true })
    @Generated('uuid')
    apikey: string;

    @Column()
    key_type: KeyTypes;

    @ManyToOne(() => Mission, (mission) => mission.api_keys, {
        onDelete: 'CASCADE',
    })
    mission: Mission;

    @OneToOne(() => Action, {
        onDelete: 'CASCADE',
    })
    action: Action;

    @ManyToOne(() => User, (user) => user.api_keys, {
        onDelete: 'CASCADE',
    })
    user: User;
}
