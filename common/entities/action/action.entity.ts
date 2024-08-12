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

    @Column({ nullable: true })
    docker_image_sha: string;

    @Column({ nullable: true })
    container_id: string;

    @Column({ nullable: true })
    executionStartedAt: Date;

    @Column({ nullable: true })
    executionEndedAt: Date;

    @Column({ nullable: true })
    runner_hostname: string;

    @Column({ nullable: true })
    runner_cpu_model: string;

    @ManyToOne(() => Mission, (mission) => mission.actions)
    mission: Mission;

    @Column({ type: 'json', nullable: true })
    logs: ContainerLog[];

    @Column({ nullable: true })
    exit_code: number;

    @OneToOne(() => Apikey)
    @JoinColumn()
    key: Apikey;
}
