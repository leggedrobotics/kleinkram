import { Column, Entity, Generated, ManyToOne, OneToOne } from 'typeorm';
import BaseEntity from '../../base-entity.entity';
import { KeyTypes } from '../../enum';
import Mission from '../../mission/entities/mission.entity';
import Action from '../../action/entities/action.entity';

@Entity()
export default class Apikey extends BaseEntity {
    @Column({ unique: true })
    @Generated('uuid')
    apikey: string;

    @Column()
    apikeytype: KeyTypes;

    @ManyToOne(() => Mission, (mission) => mission.tokens)
    mission: Mission;

    @OneToOne(() => Action)
    action: Action;
}
