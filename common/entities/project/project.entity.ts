import { Column, Entity, ManyToMany, ManyToOne, OneToMany } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import Mission from '../mission/mission.entity';
import User from '../user/user.entity';
import TagType from '../tagType/tag-type.entity';
import ProjectAccess from '../auth/project-access.entity';
import CategoryEntity from '../category/category.entity';

import { ProjectDto } from '../../api/types/project/base-project.dto';
import { ProjectWithMissionCountDto } from '../../api/types/project/project-with-mission-count.dto';
import { ProjectWithMissionsDto } from '../../api/types/project/project-with-missions.dto';

@Entity()
export default class Project extends BaseEntity {
    /**
     * The name of the project. This is the name that will be displayed in the UI.
     * The name must be globally unique.
     */
    @Column({ unique: true })
    name!: string;

    @OneToMany(() => Mission, (mission) => mission.project)
    missions?: Mission[];

    @OneToMany(() => ProjectAccess, (projectAccess) => projectAccess.project, {
        cascade: true,
    })
    project_accesses?: ProjectAccess[];

    @Column()
    description!: string;

    @ManyToOne(() => User, (user) => user.projects, { nullable: false })
    creator?: User;

    @ManyToMany(() => TagType, (tag) => tag.project, {
        onDelete: 'CASCADE',
        nullable: false,
    })
    requiredTags!: TagType[];

    @OneToMany(() => CategoryEntity, (category) => category.project)
    categories?: CategoryEntity[];
}
