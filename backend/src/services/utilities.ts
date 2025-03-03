import { Repository, SelectQueryBuilder, Brackets } from 'typeorm';
import Project from '@common/entities/project/project.entity';
import Mission from '@common/entities/mission/mission.entity';
import { parseISO, isValid } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import File from '@common/entities/file/file.entity';
import { MethodNotAllowedException } from '@nestjs/common';
import { SortOrder } from '@common/api/types/pagination';

export const stringToBoolean = (value: string): boolean | undefined => {
    value = value.toLowerCase();
    switch (value) {
        case 'true': {
            return true;
        }
        case 'false': {
            return false;
        }
    }
};

export const stringToNumber = (value: string): number | undefined => {
    if (value === '') {
        return;
    }

    const number = Number(value);
    if (!Number.isNaN(number)) {
        return number;
    }
};

export const stringToDate = (value: string): Date | undefined => {
    const date = parseISO(value);

    if (isValid(date)) {
        return date;
    }
};

export const stringToLocation = (value: string): string | undefined => {
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
): Brackets => {
    /*
     * we need to add a random token to the typeorm params as
     * in general we will add this bracket multiple times
     * to the same query
     * */

    if (tok === undefined) {
        tok = uuidv4().replaceAll('-', '');
    }

    const valueBracket = new Brackets((qb) => {
        qb.orWhere(`tags.STRING = :stringValue_${tok}`, {
            [`stringValue_${tok}`]: value,
        });
        const numberValue = stringToNumber(value);
        if (numberValue !== undefined) {
            qb.orWhere(`tags.NUMBER = :numberValue_${tok}`, {
                [`numberValue_${tok}`]: numberValue,
            });
        }
        const booleanValue = stringToBoolean(value);
        if (booleanValue !== undefined) {
            qb.orWhere(`tags.BOOLEAN = :booleanValue_${tok}`, {
                [`booleanValue_${tok}`]: booleanValue,
            });
        }
        const dateValue = stringToDate(value);
        if (dateValue !== undefined) {
            qb.orWhere(`tags.DATE = :dateValue_${tok}`, {
                [`dateValue_${tok}`]: dateValue,
            });
        }
        const locationValue = stringToLocation(value);
        if (locationValue !== undefined) {
            qb.orWhere(`tags.LOCATION = :locationValue_${tok}`, {
                [`locationValue_${tok}`]: locationValue,
            });
        }
    });

    return new Brackets((qb) => {
        qb.andWhere(`tagType.name = :key_${tok}`, {
            [`key_${tok}`]: key,
        }).andWhere(valueBracket);
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

export const getFilteredFileIdSubQuery = (
    fileRepository: Repository<File>,
    fileIds: string[],
    filePatterns: string[],
): SelectQueryBuilder<{ uuid: string }> => {
    const query = fileRepository
        .createQueryBuilder('file')
        .select('file.uuid', 'uuid');

    if (fileIds.length > 0) {
        query.orWhere('file.uuid IN (:...fileIds)', {
            fileIds,
        });
    }

    if (filePatterns.length > 0) {
        query.orWhere('file.filename LIKE ANY(ARRAY[:...filePatterns])', {
            filePatterns,
        });
    }

    return query;
};

export const addProjectFilters = (
    query: SelectQueryBuilder<any>,
    projectRepository: Repository<Project>,
    projectIds: string[],
    projectPatterns: string[],
): SelectQueryBuilder<any> => {
    if (projectIds.length > 0 || projectPatterns.length > 0) {
        const projectLikePatterns = projectPatterns.map((element) =>
            convertGlobToLikePattern(element),
        );

        const projectUUIDQuery = getFilteredProjectIdSubQuery(
            projectRepository,
            projectIds,
            projectLikePatterns,
        );

        query
            .andWhere(`project.uuid IN (${projectUUIDQuery.getQuery()})`)
            .setParameters(projectUUIDQuery.getParameters());
    }

    return query;
};

export const addMissionFilters = (
    query: SelectQueryBuilder<any>,
    missionRepository: Repository<Mission>,
    missionIds: string[],
    missionPatterns: string[],
    missionMetadata: Record<string, string>,
): SelectQueryBuilder<any> => {
    if (
        missionIds.length > 0 ||
        missionPatterns.length > 0 ||
        Object.keys(missionMetadata).length > 0
    ) {
        const missionLikePatterns = missionPatterns.map((element) =>
            convertGlobToLikePattern(element),
        );

        const missionIdSubQuery = getFilteredMissionIdSubQuery(
            missionRepository,
            missionIds,
            missionLikePatterns,
            missionMetadata,
        );

        query
            .andWhere(`mission.uuid IN (${missionIdSubQuery.getQuery()})`)
            .setParameters(missionIdSubQuery.getParameters());
    }

    return query;
};

export const addFileFilters = (
    query: SelectQueryBuilder<any>,
    fileRepository: Repository<File>,
    fileIds: string[],
    filePatterns: string[],
): SelectQueryBuilder<any> => {
    if (fileIds.length > 0 || filePatterns.length > 0) {
        const fileLikePatterns = filePatterns.map((element) =>
            convertGlobToLikePattern(element),
        );

        const fileIdSubQuery = getFilteredFileIdSubQuery(
            fileRepository,
            fileIds,
            fileLikePatterns,
        );

        query
            .andWhere(`file.uuid IN (${fileIdSubQuery.getQuery()})`)
            .setParameters(fileIdSubQuery.getParameters());
    }

    return query;
};

export const addSort = (
    query: SelectQueryBuilder<any>,
    allowedSortKeyMap: Record<string, string>,
    sortBy: string,
    sortOrder: SortOrder,
): SelectQueryBuilder<any> => {
    if (!(sortBy in allowedSortKeyMap)) {
        throw new MethodNotAllowedException(`Invalid sortBy key: ${sortBy}`);
    }

    query.orderBy(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        allowedSortKeyMap[sortBy]!,
        sortOrder === SortOrder.ASC ? 'ASC' : 'DESC',
    );
    return query;
};
