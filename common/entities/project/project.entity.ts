import { Column, Entity, ManyToMany, ManyToOne, OneToMany } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import Mission from '../mission/mission.entity';
import User from '../user/user.entity';
import TagType from '../tagType/tagType.entity';
import ProjectAccess from '../auth/project_access.entity';

@Entity()
export default class Project extends BaseEntity {
    @Column({ unique: true })
    name: string;

    @OneToMany(() => Mission, (mission) => mission.project)
    missions: Mission[];

    @OneToMany(
        () => ProjectAccess,
        (project_access) => project_access.project,
        {
            cascade: true,
            eager: true,
        },
    )
    project_accesses: ProjectAccess[];

    @Column({ nullable: true })
    description: string;

    @ManyToOne(() => User, (user) => user.projects)
    creator: User;

    @ManyToMany(() => TagType, (tag) => tag.project, {
        onDelete: 'CASCADE',
    })
    requiredTags: TagType[];
}
