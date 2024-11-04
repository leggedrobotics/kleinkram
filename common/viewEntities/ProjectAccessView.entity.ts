import { DataSource, ViewColumn, ViewEntity } from 'typeorm';
import { AccessGroupRights } from '../enum';
import Project from '../entities/project/project.entity';

@ViewEntity({
    expression: (datasource: DataSource) =>
        datasource
            .createQueryBuilder()
            .from(Project, 'project')
            .innerJoin('project.project_accesses', 'projectAccesses')
            .innerJoin('projectAccesses.accessGroup', 'accessGroup')
            .innerJoin('accessGroup.accessGroupUsers', 'accessGroupUsers')
            .innerJoin('accessGroupUsers.user', 'users')
            .select([
                'project.uuid as projectUUID',
                'users.uuid as userUUID',
                'projectAccesses.rights as rights',
                'accessGroup.uuid as accessGroupUUID',
                'projectAccesses.uuid as protectAccessUUID',
            ]),
})
export class ProjectAccessViewEntity {
    @ViewColumn({ name: 'projectuuid' })
    projectUUID: string;

    @ViewColumn({ name: 'useruuid' })
    userUUID: string;

    @ViewColumn()
    rights: AccessGroupRights;

    @ViewColumn({ name: 'accessgroupuuid' })
    accessGroupUUID: string;

    @ViewColumn({ name: 'protectaccessuuid' })
    protectAccessUUID: string;
}
