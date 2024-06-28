import { Column, Entity, ManyToMany, ManyToOne, OneToMany } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import Mission from '../mission/mission.entity';
import User from '../user/user.entity';
import AccessGroup from '../auth/accessgroup.entity';
import TagType from '../tagType/tagType.entity';

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

    @OneToMany(() => TagType, (tag) => tag.project)
    requiredTags: TagType[];
}
