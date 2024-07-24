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
            .innerJoin('accessGroup.users', 'users')
            .select([
                'project.uuid as projectUUID',
                'users.uuid as userUUID',
                'projectAccesses.rights as rights',
                'accessGroup.uuid as accessGroupUUID',
                'projectAccesses.uuid as protectAccessUUID',
            ]),
})
export class ProjectAccessViewEntity {
    @ViewColumn()
    projectUUID: string;

    @ViewColumn()
    userUUID: string;

    @ViewColumn()
    rights: AccessGroupRights;

    @ViewColumn()
    accessGroupUUID: string;

    @ViewColumn()
    protectAccessUUID: string;
}
