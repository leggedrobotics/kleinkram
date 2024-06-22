import { Column, Entity, ManyToMany, ManyToOne, OneToMany } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import Project from '../project/project.entity';
import FileEntity from '../file/file.entity';
import QueueEntity from '../queue/queue.entity';
import User from '../user/user.entity';
import Apikey from '../auth/apikey.entity';
import AccessGroup from '../auth/accessgroup.entity';

@Entity()
export default class Mission extends BaseEntity {
    @Column()
    name: string;

    @ManyToOne(() => Project, (project) => project.missions)
    project: Project;

    @OneToMany(() => FileEntity, (file) => file.mission)
    files: FileEntity[];

    @OneToMany(() => QueueEntity, (queue) => queue.mission)
    queues: QueueEntity[];

    @ManyToOne(() => User, (user) => user.missions)
    creator: User;

    @OneToMany(() => Apikey, (token) => token.mission)
    tokens: Apikey[];

    @ManyToMany(() => AccessGroup, (accessGroup) => accessGroup.missions)
    accessGroups: AccessGroup[];
}
