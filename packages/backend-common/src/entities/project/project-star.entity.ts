import { BaseEntity } from '@backend-common/entities/base-entity.entity';
import { ProjectEntity } from '@backend-common/entities/project/project.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { Entity, Index, ManyToOne } from 'typeorm';

/**
 * A star marks a project as a favorite of a single user.
 *
 * Stars are a per-user preference, not an access right: starring a project
 * neither grants nor requires more than READ access, and the star is only ever
 * visible to the user who created it.
 *
 * Stars are removed for good when a user un-stars a project (there is nothing
 * worth restoring), so the uniqueness constraint below only has to consider
 * live rows.
 */
@Index('unique_project_star_per_user', ['user', 'project'], {
    where: '"deletedAt" IS NULL',
    unique: true,
})
@Entity({ name: 'project_star' })
export class ProjectStarEntity extends BaseEntity {
    @ManyToOne(() => UserEntity, (user: UserEntity) => user.starredProjects, {
        nullable: false,
        onDelete: 'CASCADE',
    })
    user?: UserEntity;

    @ManyToOne(() => ProjectEntity, (project: ProjectEntity) => project.stars, {
        nullable: false,
        onDelete: 'CASCADE',
    })
    project?: ProjectEntity;
}
