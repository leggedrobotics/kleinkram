import { ProjectEntity } from '@backend-common/entities/project/project.entity';
import { AccessGroupRights } from '@kleinkram/shared';
import type { DataSource, SelectQueryBuilder } from 'typeorm';
import { ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({
    expression: (datasource: DataSource): SelectQueryBuilder<ProjectEntity> =>
        datasource
            .createQueryBuilder(ProjectEntity, 'project')
            .innerJoin('project.project_accesses', 'projectAccesses')
            .innerJoin('projectAccesses.accessGroup', 'accessGroup')
            .innerJoin(
                'accessGroup.memberships',
                'memberships',
                'memberships.expirationDate IS NULL OR memberships.expirationDate > NOW()',
            )
            .innerJoin('memberships.user', 'user')
            .select([
                'project.uuid as projectUUID',
                'user.uuid as userUUID',
                // Use MAX() to find the highest right for this user/project pair
                'MAX(projectAccesses.rights) as rights',
            ])
            // Group by user and project to get one row per pair
            .groupBy('project.uuid')
            .addGroupBy('user.uuid'),
})
export class ProjectAccessViewEntity {
    @ViewColumn({ name: 'projectuuid' })
    projectUuid!: string;

    @ViewColumn({ name: 'useruuid' })
    userUuid!: string;

    /** The highest level of access rights the user has for the project. */
    @ViewColumn()
    rights!: AccessGroupRights;
}
