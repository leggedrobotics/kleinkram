import { FileEntity as File } from '@kleinkram/backend-common/entities/file/file.entity';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { ProjectEntity } from '@kleinkram/backend-common/entities/project/project.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { MissionAccessViewEntity } from '@kleinkram/backend-common/viewEntities/mission-access-view.entity';
import { ProjectAccessViewEntity } from '@kleinkram/backend-common/viewEntities/project-access-view.entity';
import { UserRole } from '@kleinkram/shared';
import { Brackets, SelectQueryBuilder } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

export const projectAccessUUIDQuery = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: SelectQueryBuilder<any>,
    userUUID: string,
    tok: string | undefined = undefined,
): SelectQueryBuilder<ProjectAccessViewEntity> => {
    // we us randomized tokens to creat a signature for the subquery parameters
    // in this way we avoid conflicts with other subqueries or the main query
    // would be nice if typeorm did this out of the box, but it doesnt
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    if (tok === undefined) tok = uuidv4().replaceAll('-', '');

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: SelectQueryBuilder<any>,
    userUUID: string,
    tok: string | undefined = undefined,
): SelectQueryBuilder<MissionAccessViewEntity> => {
    // we us randomized tokens to creat a signature for the subquery parameters
    // in this way we avoid conflicts with other subqueries or the main query
    // would be nice if typeorm did this out of the box, but it doesnt
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    if (tok === undefined) tok = uuidv4().replaceAll('-', '');

    return query
        .subQuery()
        .select('DISTINCT "missionAccessView"."missionuuid"', 'missionuuid')
        .from(MissionAccessViewEntity, 'missionAccessView')
        .where(`"missionAccessView"."useruuid" = :userUUID_${tok}`, {
            [`userUUID_${tok}`]: userUUID,
        });
};

export const getUserIsAdminSubQuery = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: SelectQueryBuilder<any>,
    userUUID: string,
    tok: string | undefined = undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): SelectQueryBuilder<any> => {
    // we us randomized tokens to creat a signature for the subquery parameters
    // in this way we avoid conflicts with other subqueries or the main query
    // would be nice if typeorm did this out of the box, but it doesnt
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    if (tok === undefined) tok = uuidv4().replaceAll('-', '');

    const subQuery = query
        .subQuery()
        .select('user.role')
        .from(UserEntity, 'user');
    subQuery.where(`user.uuid = :userUUID_${tok}`, {
        [`userUUID_${tok}`]: userUUID,
    });
    subQuery.andWhere(`user.role = :adminRole_${tok}`, {
        [`adminRole_${tok}`]: UserRole.ADMIN,
    });
    return subQuery;
};

export const addAccessConstraintsToProjectQuery = (
    query: SelectQueryBuilder<ProjectEntity>,
    userUUID: string,
): SelectQueryBuilder<ProjectEntity> => {
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
    query: SelectQueryBuilder<MissionEntity>,
    userUUID: string,
): SelectQueryBuilder<MissionEntity> => {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    qb: SelectQueryBuilder<any>,
    userUUID: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
