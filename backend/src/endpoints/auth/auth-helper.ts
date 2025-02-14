import { Brackets, SelectQueryBuilder } from 'typeorm';
import Project from '@common/entities/project/project.entity';
import { ProjectAccessViewEntity } from '@common/viewEntities/project-access-view.entity';
import Mission from '@common/entities/mission/mission.entity';
import { MissionAccessViewEntity } from '@common/viewEntities/mission-access-view.entity';
import { v4 as uuidv4 } from 'uuid';
import File from '@common/entities/file/file.entity';
import User from '@common/entities/user/user.entity';
import { UserRole } from '@common/frontend_shared/enum';

export const projectAccessUUIDQuery = (
    query: SelectQueryBuilder<any>,
    userUUID: string,
    tok: string | undefined = undefined,
): SelectQueryBuilder<ProjectAccessViewEntity> => {
    // we us randomized tokens to creat a signature for the subquery parameters
    // in this way we avoid conflicts with other subqueries or the main query
    // would be nice if typeorm did this out of the box, but it doesnt
    if (tok === undefined) tok = uuidv4().replace(/-/g, '');

    const projectIdsQuery = query
        .subQuery()
        .select('projectAccess.projectuuid', 'projectUUID')
        .from(ProjectAccessViewEntity, 'projectAccess')
        .where(`projectAccess.useruuid = :userUUID_${tok}`, {
            [`userUUID_${tok}`]: userUUID,
        });

    return projectIdsQuery;
};

export const missionAccessUUIDQuery = (
    query: SelectQueryBuilder<any>,
    userUUID: string,
    tok: string | undefined = undefined,
): SelectQueryBuilder<MissionAccessViewEntity> => {
    // we us randomized tokens to creat a signature for the subquery parameters
    // in this way we avoid conflicts with other subqueries or the main query
    // would be nice if typeorm did this out of the box, but it doesnt
    if (tok === undefined) tok = uuidv4().replace(/-/g, '');

    return query
        .subQuery()
        .select('DISTINCT "missionAccessView"."missionuuid"', 'missionuuid')
        .from(MissionAccessViewEntity, 'missionAccessView')
        .where(`"missionAccessView"."useruuid" = :userUUID_${tok}`, {
            [`userUUID_${tok}`]: userUUID,
        });
};

export const getUserIsAdminSubQuery = (
    query: SelectQueryBuilder<any>,
    userUUID: string,
    tok: string | undefined = undefined,
): SelectQueryBuilder<any> => {
    // we us randomized tokens to creat a signature for the subquery parameters
    // in this way we avoid conflicts with other subqueries or the main query
    // would be nice if typeorm did this out of the box, but it doesnt
    if (tok === undefined) tok = uuidv4().replace(/-/g, '');

    const subQuery = query.subQuery().select('user.role').from(User, 'user');
    subQuery.where(`user.uuid = :userUUID_${tok}`, {
        [`userUUID_${tok}`]: userUUID,
    });
    subQuery.andWhere(`user.role = :adminRole_${tok}`, {
        [`adminRole_${tok}`]: UserRole.ADMIN,
    });
    return subQuery;
};

export const addAccessConstraintsToProjectQuery = (
    query: SelectQueryBuilder<Project>,
    userUUID: string,
): SelectQueryBuilder<Project> => {
    const projectUUIDQuery = projectAccessUUIDQuery(query, userUUID);
    const userIsAdminSubQuery = getUserIsAdminSubQuery(query, userUUID);

    query.where(
        new Brackets((qb) => {
            qb.where(`EXISTS (${userIsAdminSubQuery.getQuery()})`);
            qb.orWhere(`project.uuid IN (${projectUUIDQuery.getQuery()})`);
        }),
    );

    query.setParameters(userIsAdminSubQuery.getParameters());
    query.setParameters(projectUUIDQuery.getParameters());

    return query;
};

export const addAccessConstraintsToMissionQuery = (
    query: SelectQueryBuilder<Mission>,
    userUUID: string,
): SelectQueryBuilder<Mission> => {
    const missionUUIDQuery = missionAccessUUIDQuery(query, userUUID);
    const projectUUIDQuery = projectAccessUUIDQuery(query, userUUID);

    const accessBracket = new Brackets((qb) => {
        qb.where(`mission.uuid IN (${missionUUIDQuery.getQuery()})`);
        qb.orWhere(`project.uuid IN (${projectUUIDQuery.getQuery()})`);
    });

    const userIsAdminSubQuery = getUserIsAdminSubQuery(query, userUUID);

    query.andWhere(
        new Brackets((qb) => {
            qb.where(`EXISTS (${userIsAdminSubQuery.getQuery()})`);
            qb.orWhere(accessBracket);
        }),
    );

    query.setParameters(userIsAdminSubQuery.getParameters());
    query.setParameters(missionUUIDQuery.getParameters());
    query.setParameters(projectUUIDQuery.getParameters());

    return query;
};

export const addAccessConstraintsToFileQuery = (
    query: SelectQueryBuilder<File>,
    userUUID: string,
): SelectQueryBuilder<File> => {
    const missionUUIDQuery = missionAccessUUIDQuery(query, userUUID);
    const projectUUIDQuery = projectAccessUUIDQuery(query, userUUID);

    const accessBracket = new Brackets((qb) => {
        qb.where(`mission.uuid IN (${missionUUIDQuery.getQuery()})`);
        qb.orWhere(`project.uuid IN (${projectUUIDQuery.getQuery()})`);
    });

    const userIsAdminSubQuery = getUserIsAdminSubQuery(query, userUUID);

    query.andWhere(
        new Brackets((qb) => {
            qb.where(`EXISTS (${userIsAdminSubQuery.getQuery()})`);
            qb.orWhere(accessBracket);
        }),
    );

    query.setParameters(userIsAdminSubQuery.getParameters());
    query.setParameters(missionUUIDQuery.getParameters());
    query.setParameters(projectUUIDQuery.getParameters());

    return query;
};

// TODO: deprecate this in favor of the above functions
export function addAccessConstraints(
    qb: SelectQueryBuilder<any>,
    userUUID: string,
): SelectQueryBuilder<any> {
    // Add project access join
    qb.leftJoin(
        (subQuery) => {
            return subQuery
                .select(
                    'DISTINCT "projectAccessView"."projectuuid"',
                    'projectuuid',
                )
                .from('project_access_view_entity', 'projectAccessView')
                .where('"projectAccessView"."useruuid" = :userUUID', {
                    userUUID,
                });
        },
        'projectAccess',
        '"projectAccess"."projectuuid" = "project"."uuid"',
    );

    // Add mission access join
    qb.leftJoin(
        (subQuery) => {
            return subQuery
                .select(
                    'DISTINCT "missionAccessView"."missionuuid"',
                    'missionuuid',
                )
                .from('mission_access_view_entity', 'missionAccessView')
                .where('"missionAccessView"."useruuid" = :userUUID', {
                    userUUID,
                });
        },
        'missionAccess',
        '"missionAccess"."missionuuid" = "mission"."uuid"',
    );

    qb.andWhere(
        new Brackets((_qb) => {
            _qb.where('"missionAccess"."missionuuid" IS NOT NULL').orWhere(
                '"projectAccess"."projectuuid" IS NOT NULL',
            );
        }),
    );

    return qb;
}
