import { Repository, SelectQueryBuilder, Brackets } from 'typeorm';
import Project from '@common/entities/project/project.entity';
import Mission from '@common/entities/mission/mission.entity';

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

const metadataMatchesKeyValuePair = (key: string, value: string) => {
    return new Brackets((qb) => {
        qb.where('tags.STRING = :value', { value });
        qb.orWhere('tags.NUMBER = :value', { value: Number(value) });
        qb.orWhere('tags.BOOLEAN = :value', { value: Boolean(value) });
        qb.orWhere('tags.DATE = :value', { value: new Date(value) });
        qb.orWhere('tags.LOCATION = :value', { value });
        qb.andWhere('tagType.name = :key', { key: key });
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
