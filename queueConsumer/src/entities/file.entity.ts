import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import Mission from './mission.entity';
import Topic from './topic.entity';
import User from './user.entity';
import { FileType } from '../enum';

@Entity()
export default class File extends BaseEntity {
    @ManyToOne(() => Mission, (mission) => mission.files)
    mission: Mission;

    @Column()
    date: Date;

    @OneToMany(() => Topic, (topic) => topic.file, { cascade: ['remove'] })
    topics: Topic[];

    @Column()
    filename: string;

    @Column({ type: 'bigint' })
    size: number;

    @ManyToOne(() => User, (user) => user.files)
    creator: User;

    @Column()
    type: FileType;
}
