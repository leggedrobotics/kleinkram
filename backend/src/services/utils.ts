import { Repository, SelectQueryBuilder, Brackets } from 'typeorm';
import Project from '@common/entities/project/project.entity';
import Mission from '@common/entities/mission/mission.entity';
import { parseISO, isValid } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

const stringToBoolean = (value: string): boolean | undefined => {
    value = value.toLowerCase();
    switch (value) {
        case 'true':
            return true;
        case 'false':
            return false;
    }
};

const stringToNumber = (value: string): number | undefined => {
    const number = Number(value);
    if (!Number.isNaN(number)) {
        return number;
    }
};

const stringToDate = (value: string): Date | undefined => {
    const date = parseISO(value);
    if (isValid(date)) {
        return date;
    }
};

const stringToLocation = (value: string): string | undefined => {
    return value;
};

export const convertGlobToLikePattern = (glob: string) => {
    return glob
        .replaceAll('%', String.raw`\%`)
        .replaceAll('_', String.raw`\_`)
        .replaceAll('*', '%')
        .replaceAll('?', '_');
};

export const getFilteredProjectIdSubQuery = (
    projectRepository: Repository<Project>,
    projectIds: string[],
    projectPatterns: string[],
): SelectQueryBuilder<{ uuid: string }> => {
    const query = projectRepository
        .createQueryBuilder('project')
        .select('project.uuid', 'uuid');

    if (projectIds.length > 0) {
        query.orWhere('project.uuid IN (:...projectIds)', {
            projectIds,
        });
    }

    if (projectPatterns.length > 0) {
        query.orWhere('project.name LIKE ANY(ARRAY[:...projectPatterns])', {
            projectPatterns,
        });
    }

    return query;
};

const metadataMatchesKeyValuePair = (
    key: string,
    value: string,
    tok: string | undefined = undefined,
) => {
    /*
     * we need to add a random token to the typeorm params as
     * in general we will add this bracket multiple times
     * to the same query
     * */

    if (tok === undefined) {
        tok = uuidv4().replace(/-/g, '');
    }

    return new Brackets((qb) => {
        qb.orWhere(`tags.STRING = :stringValue${tok}`, {
            [`stringValue${tok}`]: value,
        });
        const numberValue = stringToNumber(value);
        if (numberValue !== undefined) {
            qb.orWhere(`tags.NUMBER = :numberValue${tok}`, {
                [`numberValue${tok}`]: numberValue,
            });
        }
        const booleanValue = stringToBoolean(value);
        if (booleanValue !== undefined) {
            qb.orWhere(`tags.BOOLEAN = :booleanValue${tok}`, {
                [`booleanValue${tok}`]: booleanValue,
            });
        }
        const dateValue = stringToDate(value);
        if (dateValue !== undefined) {
            qb.orWhere(`tags.DATE = :dateValue${tok}`, {
                [`dateValue${tok}`]: dateValue,
            });
        }
        const locationValue = stringToLocation(value);
        if (locationValue !== undefined) {
            qb.orWhere(`tags.LOCATION = :locationValue${tok}`, {
                [`locationValue${tok}`]: locationValue,
            });
        }
        qb.andWhere(`tagType.name = :key${tok}`, { [`key${tok}`]: key });
    });
};

export const getFilteredMissionIdSubQuery = (
    missionRepository: Repository<Mission>,
    missionIds: string[],
    missionPatterns: string[],
    missionMetadata: Record<string, string>,
): SelectQueryBuilder<{ uuid: string }> => {
    const query = missionRepository
        .createQueryBuilder('mission')
        .select('mission.uuid', 'uuid');

    if (missionIds.length > 0) {
        query.orWhere('mission.uuid IN (:...missionIds)', {
            missionIds,
        });
    }

    if (missionPatterns.length > 0) {
        query.orWhere('mission.name LIKE ANY(ARRAY[:...missionPatterns])', {
            missionPatterns,
        });
    }

    if (Object.keys(missionMetadata).length > 0) {
        query
            .leftJoin('mission.tags', 'tags')
            .leftJoin('tags.tagType', 'tagType');

        for (const [key, value] of Object.entries(missionMetadata)) {
            query.orWhere(metadataMatchesKeyValuePair(key, value));
        }
    }

    return query;
};
