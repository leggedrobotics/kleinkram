import { Brackets, SelectQueryBuilder } from 'typeorm';
import Project from '@common/entities/project/project.entity';
import Mission from '@common/entities/mission/mission.entity';
import { MissionAccessViewEntity } from '@common/viewEntities/mission-access-view.entity';
import { ProjectAccessViewEntity } from '@common/viewEntities/project-access-view.entity';

export const addAccessConstraintsForMissionOnly = (
    query: SelectQueryBuilder<Mission>,
    userId: string,
    accessLevel: number,
): SelectQueryBuilder<Mission> => {
    query.leftJoin(
        (q) => {
            return q
                .select(
                    'DISTINCT "missionAccessView"."missionuuid"',
                    'missionuuid',
                )
                .from(MissionAccessViewEntity, 'missionAccessView')
                .where('"missionAccessView"."useruuid" = :userId', {
                    userId,
                })
                .andWhere('"missionAccessView"."rights" >= :accessLevel', {
                    accessLevel,
                });
        },
        'missionAccess',
        '"missionAccess"."missionuuid" = "mission"."uuid"',
    );
    return query;
};

export const addAccessConstraintsForProjectOnly = <T extends Project | Mission>(
    query: SelectQueryBuilder<T>,
    userId: string,
    accessLevel: number,
): SelectQueryBuilder<T> => {
    // left joins projectAccess.

    query.leftJoin(
        (q) => {
            return q
                .select(
                    'DISTINCT "projectAccessView"."projectuuid"',
                    'projectuuid',
                )
                .from(ProjectAccessViewEntity, 'projectAccessView')
                .where('"projectAccessView"."useruuid" = :userId', {
                    userId,
                })
                .andWhere('"projectAccessView"."rights" >= :accessLevel', {
                    accessLevel,
                });
        },
        'projectAccess',
        '"projectAccess"."projectuuid" = "project"."uuid"',
    );
    return query;
};

export const addAccessConstraintsToMissions = (
    query: SelectQueryBuilder<Mission>,
    userId: string,
    accessLevel: number,
): SelectQueryBuilder<Mission> => {
    // filter missions such that userId has sufficient accessLevel on either
    // the mission or the project

    query = addAccessConstraintsForMissionOnly(query, userId, accessLevel);
    query = addAccessConstraintsForProjectOnly(query, userId, accessLevel);

    query.andWhere(
        new Brackets((qb) => {
            qb.where('"missionAccess"."missionuuid" IS NOT NULL').orWhere(
                '"projectAccess"."projectuuid" IS NOT NULL',
            );
        }),
    );

    return query;
};

export const addAccessConstraintsToProjects = (
    query: SelectQueryBuilder<Project>,
    userUuid: string,
    accessLevel: number,
): SelectQueryBuilder<Project> => {
    // filter projects such that userId has sufficient accessLevel

    query = addAccessConstraintsForProjectOnly(query, userUuid, accessLevel);
    query.andWhere('"projectAccess"."projectuuid" IS NOT NULL');
    return query;
};

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
