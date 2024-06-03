import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import BaseEntity from '../../base-entity.entity';
import Project from '../../project/entities/project.entity';
import File from '../../file/entities/file.entity';
import QueueEntity from '../../queue/entities/queue.entity';
import User from '../../user/entities/user.entity';
import Apikey from '../../auth/entities/apikey.entity';

@Entity()
export default class Mission extends BaseEntity {
    @Column()
    name: string;

    @ManyToOne(() => Project, (project) => project.missions)
    project: Project;

    @OneToMany(() => File, (file) => file.mission)
    files: File[];

    @OneToMany(() => QueueEntity, (queue) => queue.mission)
    queues: QueueEntity[];

    @ManyToOne(() => User, (user) => user.missions)
    creator: User;

    @OneToMany(() => Apikey, (token) => token.mission)
    tokens: Apikey[];
}
