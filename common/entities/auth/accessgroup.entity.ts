import {
    Column,
    Entity,
    JoinTable,
    ManyToMany,
    ManyToOne,
    OneToMany,
} from 'typeorm';
import BaseEntity from '../base-entity.entity';
import User from '../user/user.entity';
import ProjectAccess from './project_access.entity';
import MissionAccess from './mission_access.entity';

@Entity()
export default class AccessGroup extends BaseEntity {
    @Column()
    name: string;

    @ManyToMany(() => User, (user) => user.accessGroups)
    @JoinTable()
    users: User[];

    @OneToMany(
        () => ProjectAccess,
        (projectAccess) => projectAccess.accessGroup,
    )
    // eslint-disable-next-line @typescript-eslint/naming-convention
    project_accesses: ProjectAccess[];

    @OneToMany(
        () => MissionAccess,
        (missionAccess) => missionAccess.accessGroup,
    )
    @JoinTable()
    // eslint-disable-next-line @typescript-eslint/naming-convention
    mission_accesses: MissionAccess[];

    @Column()
    personal: boolean;

    @Column({ default: false })
    inheriting: boolean;

    @ManyToOne(() => User, (user) => user.files, { nullable: true })
    creator: User;
}
