import { Column, Entity, ManyToOne, OneToMany, Unique } from 'typeorm';
import Action from '../action/action.entity';
import Apikey from '../auth/apikey.entity';
import MissionAccess from '../auth/mission-access.entity';
import BaseEntity from '../base-entity.entity';
import FileEntity from '../file/file.entity';
import Project from '../project/project.entity';
import QueueEntity from '../queue/queue.entity';
import Tag from '../tag/tag.entity';
import User from '../user/user.entity';

@Unique('unique_mission_name_per_project', ['name', 'project'])
@Entity()
export default class Mission extends BaseEntity {
    @Column()
    name!: string;

    @ManyToOne(() => Project, (project) => project.missions, {
        nullable: false,
    })
    project?: Project;

    @OneToMany(() => FileEntity, (file) => file.mission)
    files?: FileEntity[];

    @OneToMany(() => Action, (action) => action.mission)
    actions?: Action[];

    @OneToMany(() => QueueEntity, (queue) => queue.mission)
    queues?: QueueEntity[];

    @ManyToOne(() => User, (user) => user.missions, { nullable: false })
    creator?: User;

    @OneToMany(() => Apikey, (apiKey) => apiKey.mission)
    api_keys?: Apikey[];

    @OneToMany(() => MissionAccess, (missionAccess) => missionAccess.mission)
    mission_accesses?: MissionAccess[];

    @OneToMany(() => Tag, (tag) => tag.mission)
    tags?: Tag[];

    fileCount?: number;
    size?: number;
}
