import { ProjectAccessEntity } from '@backend-common/entities/auth/project-access.entity';
import { BaseEntity } from '@backend-common/entities/base-entity.entity';
import { CategoryEntity } from '@backend-common/entities/category/category.entity';
import { MetadataTypeEntity } from '@backend-common/entities/metadata/metadata-type.entity';
import { MissionEntity } from '@backend-common/entities/mission/mission.entity';
import { ProjectStarEntity } from '@backend-common/entities/project/project-star.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import {
    Column,
    Entity,
    Index,
    ManyToMany,
    ManyToOne,
    OneToMany,
} from 'typeorm';

@Index('unique_project_name_active', ['name'], {
    where: '"deletedAt" IS NULL',
    unique: true,
})
@Entity({ name: 'project' })
export class ProjectEntity extends BaseEntity {
    /**
     * The name of the project. This is the name that will be displayed in the UI.
     * The name must be unique among active (non-deleted) projects.
     */
    @Column()
    name!: string;

    @OneToMany(() => MissionEntity, (mission: MissionEntity) => mission.project)
    missions?: MissionEntity[];
    readonly missionCount?: number;

    @OneToMany(
        () => ProjectAccessEntity,
        (projectAccess: ProjectAccessEntity) => projectAccess.project,
        {
            cascade: true,
        },
    )

    // eslint-disable-next-line @typescript-eslint/naming-convention
    project_accesses?: ProjectAccessEntity[];

    @Column()
    description!: string;

    @ManyToOne(() => UserEntity, (user: UserEntity) => user.projects, {
        nullable: false,
    })
    creator?: UserEntity;

    @ManyToMany(
        () => MetadataTypeEntity,
        (metadataType: MetadataTypeEntity) => metadataType.projects,
        { onDelete: 'CASCADE', nullable: false },
    )
    requiredMetadataTypes!: MetadataTypeEntity[];

    @OneToMany(
        () => CategoryEntity,
        (category: CategoryEntity) => category.project,
    )
    categories?: CategoryEntity[];

    @Column({ default: false })
    autoConvert?: boolean;

    @OneToMany(
        () => ProjectStarEntity,
        (star: ProjectStarEntity) => star.project,
    )
    stars?: ProjectStarEntity[];
}
