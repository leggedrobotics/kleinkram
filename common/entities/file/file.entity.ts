import { Column, Entity, ManyToOne, OneToMany, Unique } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import Topic from '../topic/topic.entity';
import Mission from '../mission/mission.entity';
import User from '../user/user.entity';
import { FileType } from '../../enum';

@Entity()
@Unique(['filename', 'mission'])
export default class FileEntity extends BaseEntity {
    @ManyToOne(() => Mission, (mission) => mission.files)
    mission: Mission;

    @Column()
    date: Date;

    @OneToMany(() => Topic, (topic) => topic.file)
    topics: Topic[];

    @Column()
    filename: string;

    @Column({ type: 'bigint' })
    size: number;

    @ManyToOne(() => User, (user) => user.files)
    creator: User;

    @Column()
    type: FileType;

    @Column()
    tentative: boolean;
}
