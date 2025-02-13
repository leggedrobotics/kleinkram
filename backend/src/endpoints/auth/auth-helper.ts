import { Brackets, SelectQueryBuilder } from 'typeorm';
import Project from '@common/entities/project/project.entity';
import { ProjectAccessViewEntity } from '@common/viewEntities/project-access-view.entity';
import Mission from '@common/entities/mission/mission.entity';
import { MissionAccessViewEntity } from '@common/viewEntities/mission-access-view.entity';
import { v4 as uuidv4 } from 'uuid';
import File from '@common/entities/file/file.entity';

export const projectAccessUUIDQuery = (
    query: SelectQueryBuilder<any>,
    userUUID: string,
    tok: string | undefined = undefined,
): SelectQueryBuilder<ProjectAccessViewEntity> => {
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
    if (tok === undefined) tok = uuidv4().replace(/-/g, '');

    return query
        .subQuery()
        .select('DISTINCT "missionAccessView"."missionuuid"', 'missionuuid')
        .from(MissionAccessViewEntity, 'missionAccessView')
        .where(`"missionAccessView"."useruuid" = :userUUID_${tok}`, {
            [`userUUID_${tok}`]: userUUID,
        });
};

export const addAccessConstraintsToProjectQuery = (
    query: SelectQueryBuilder<Project>,
    userUUID: string,
): SelectQueryBuilder<Project> => {
    const projectUUIDQuery = projectAccessUUIDQuery(query, userUUID);

    query.where(
        new Brackets((qb) => {
            qb.where(`project.uuid IN (${projectUUIDQuery.getQuery()})`);
            qb.orWhere('creator.role = :adminRole', {
                adminRole: 'ADMIN',
            });
        }),
    );

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

    query.andWhere(
        new Brackets((qb) => {
            qb.where(accessBracket);
            qb.orWhere('user.role = :adminRole', { adminRole: 'ADMIN' });
        }),
    );

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

    query.andWhere(
        new Brackets((qb) => {
            qb.where(accessBracket);
            qb.orWhere('user.role = :adminRole', { adminRole: 'ADMIN' });
        }),
    );

    query.setParameters(missionUUIDQuery.getParameters());
    query.setParameters(projectUUIDQuery.getParameters());

    return query;
};

// TODO: deprecate this in favor of the above two functions
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
