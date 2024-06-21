import { Column, Entity, ManyToOne, OneToOne, JoinColumn } from 'typeorm';
import BaseEntity from '../../base-entity.entity';
import Mission from '../../mission/entities/mission.entity';
import Apikey from '../../auth/entities/apikey.entity';
import { ActionState } from '../../enum';

export type ContainerLog = {
    timestamp: string;
    message: string;
    type: 'stdout' | 'stderr';
};

@Entity()
export default class Action extends BaseEntity {
    @Column()
    state: ActionState;

    @Column({ nullable: true })
    state_cause: string;

    @Column()
    docker_image: string;

    @ManyToOne(() => Mission, (mission) => mission.files)
    mission: Mission;

    @Column({ type: 'json', nullable: true })
    logs: ContainerLog[];

    @OneToOne(() => Apikey)
    @JoinColumn()
    key: Apikey;
}
