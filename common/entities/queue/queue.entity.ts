import BaseEntity from '../base-entity.entity';
import {FileLocation, FileState} from '../../enum';
import Mission from '../mission/mission.entity';
import User from '../user/user.entity';
import {Column, Entity, ManyToOne} from 'typeorm';

@Entity()
export default class QueueEntity extends BaseEntity {
    @Column()
    identifier: string;

    @Column()
    filename: string;

    @Column({
        type: 'enum',
        enum: FileState,
        default: 'PENDING',
    })
    state: FileState;

    @ManyToOne(() => Mission, (project) => project.queues)
    mission: Mission;

    @Column({
        type: 'enum',
        enum: FileLocation,
        default: 'DRIVE',
    })
    location: FileLocation;

    @Column({nullable: true, default: null})
    processingDuration: number;

    @ManyToOne(() => User, (user) => user.queues)
    creator: User;
}
