import { Column, Entity, ManyToMany, ManyToOne, OneToMany } from 'typeorm';
import BaseEntity from '../../base-entity.entity';
import Mission from '../../mission/entities/mission.entity';
import User from '../../user/entities/user.entity';
import AccessGroup from '../../auth/entities/accessgroup.entity';

@Entity()
export default class Project extends BaseEntity {
    @Column({ unique: true })
    name: string;

    @OneToMany(() => Mission, (mission) => mission.project)
    missions: Mission[];

    @ManyToMany(() => AccessGroup, (accessGroup) => accessGroup.projects)
    accessGroups: AccessGroup[];

    @Column({ nullable: true })
    description: string;

    @ManyToOne(() => User, (user) => user.projects)
    creator: User;
}
