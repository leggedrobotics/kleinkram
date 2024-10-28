import { Column, Entity, ManyToMany, ManyToOne, OneToMany } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import Mission from '../mission/mission.entity';
import User from '../user/user.entity';
import TagType from '../tagType/tagType.entity';
import ProjectAccess from '../auth/project_access.entity';
import CategoryEntity from '../category/category.entity';

@Entity()
export default class Project extends BaseEntity {
    @Column({ unique: true })
    name: string;

    @OneToMany(() => Mission, (mission) => mission.project)
    missions: Mission[];

    @OneToMany(() => ProjectAccess, (projectAccess) => projectAccess.project, {
        cascade: true,
        eager: true,
    })
    // eslint-disable-next-line @typescript-eslint/naming-convention
    project_accesses: ProjectAccess[];

    @Column({ nullable: true })
    description: string;

    @ManyToOne(() => User, (user) => user.projects)
    creator: User;

    @ManyToMany(() => TagType, (tag) => tag.project, {
        onDelete: 'CASCADE',
    })
    requiredTags: TagType[];

    @OneToMany(() => CategoryEntity, (category) => category.project)
    categories: CategoryEntity[];
}
