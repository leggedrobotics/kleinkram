import { ProjectAccessEntity } from '@backend-common/entities/auth/project-access.entity';
import { BaseEntity } from '@backend-common/entities/base-entity.entity';
import { CategoryEntity } from '@backend-common/entities/category/category.entity';
import { MissionEntity } from '@backend-common/entities/mission/mission.entity';
import { TagTypeEntity } from '@backend-common/entities/tagType/tag-type.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { Column, Entity, ManyToMany, ManyToOne, OneToMany } from 'typeorm';

@Entity({ name: 'project' })
export class ProjectEntity extends BaseEntity {
    /**
     * The name of the project. This is the name that will be displayed in the UI.
     * The name must be globally unique.
     */
    @Column({ unique: true })
    name!: string;

    @OneToMany(() => MissionEntity, (mission) => mission.project)
    missions?: MissionEntity[];
    readonly missionCount?: number;

    @OneToMany(
        () => ProjectAccessEntity,
        (projectAccess) => projectAccess.project,
        {
            cascade: true,
        },
    )

    // eslint-disable-next-line @typescript-eslint/naming-convention
    project_accesses?: ProjectAccessEntity[];

    @Column()
    description!: string;

    @ManyToOne(() => UserEntity, (user) => user.projects, { nullable: false })
    creator?: UserEntity;

    @ManyToMany(() => TagTypeEntity, (tag) => tag.project, {
        onDelete: 'CASCADE',
        nullable: false,
    })
    requiredTags!: TagTypeEntity[];

    @OneToMany(() => CategoryEntity, (category) => category.project)
    categories?: CategoryEntity[];

    @Column({ default: false })
    autoConvert?: boolean;
}
