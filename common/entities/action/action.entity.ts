import { Column, Entity, JoinColumn, ManyToOne, OneToOne } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import Mission from '../mission/mission.entity';
import Apikey from '../auth/apikey.entity';
import { ActionState } from '../../enum';
import User from '../user/user.entity';

export type ContainerLog = {
    timestamp: string;
    message: string;
    type: 'stdout' | 'stderr';
};

@Entity()
export default class Action extends BaseEntity {
    @Column()
    state: ActionState;

    @ManyToOne(() => User, (user) => user.submittedActions)
    createdBy: User;

    @Column({ nullable: true })
    state_cause: string;

    @Column()
    docker_image: string;

    @ManyToOne(() => Mission, (mission) => mission.actions)
    mission: Mission;

    @Column({ type: 'json', nullable: true })
    logs: ContainerLog[];

    @OneToOne(() => Apikey)
    @JoinColumn()
    key: Apikey;
}
