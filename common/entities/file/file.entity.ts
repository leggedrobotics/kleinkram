import { Column, Entity, ManyToOne, OneToMany, Unique } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import Topic from '../topic/topic.entity';
import Mission from '../mission/mission.entity';
import User from '../user/user.entity';
import { FileState, FileType } from '../../enum';

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

    @Column({
        type: 'bigint',
        transformer: {
            to: (value: number) => value,
            from: (value: string) => parseInt(value, 10),
        },
    })
    size: number;

    @ManyToOne(() => User, (user) => user.files)
    creator: User;

    @Column()
    type: FileType;

    @Column({ default: FileState.OK })
    state: FileState;
}
