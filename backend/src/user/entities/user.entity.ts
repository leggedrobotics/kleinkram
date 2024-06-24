import {
    Column,
    Entity,
    JoinColumn,
    ManyToMany,
    OneToMany,
    OneToOne,
} from 'typeorm';
import BaseEntity from '../../base-entity.entity';
import { UserRole } from '../../enum';
import Project from '../../project/entities/project.entity';
import Mission from '../../mission/entities/mission.entity';
import File from '../../file/entities/file.entity';
import QueueEntity from '../../queue/entities/queue.entity';
import Account from '../../auth/entities/account.entity';
import AccessGroup from '../../auth/entities/accessgroup.entity';

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
    @JoinColumn({ name: 'account_uuid' })
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
