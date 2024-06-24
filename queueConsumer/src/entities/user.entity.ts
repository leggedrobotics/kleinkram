import {Column, Entity, JoinColumn, ManyToMany, OneToMany, OneToOne,} from 'typeorm';
import BaseEntity from '../base-entity.entity';
import {UserRole} from '../enum';
import Project from './project.entity';
import Mission from './mission.entity';
import File from './file.entity';
import QueueEntity from './queue.entity';
import AccessGroup from './accessgroup.entity';
import Account from './account.entity';

@Entity()
export default class User extends BaseEntity {
    @Column()
    name: string;

    @Column({unique: true})
    email: string;

    @Column()
    role: UserRole;

    @Column({nullable: true})
    avatarUrl: string;

    @OneToOne(() => Account, (account) => account.user)
    @JoinColumn({name: 'account_uuid'})
    account: Account;

    @ManyToMany(() => AccessGroup, (accessGroup) => accessGroup.users)
    accessGroups: AccessGroup[];

    @OneToMany(() => Project, (project) => project.creator)
    projects: Project[];

    @OneToMany(() => Mission, (mission) => mission.creator)
    missions: Mission[];

    @OneToMany(() => File, (file) => file.creator)
    files: File[];

    @OneToMany(() => QueueEntity, (queue) => queue.creator)
    queues: QueueEntity[];
}