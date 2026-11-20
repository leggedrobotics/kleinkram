import {
    addAccessConstraintsToFileQuery,
    addAccessConstraintsToMissionQuery,
} from '@/endpoints/auth/auth-helper';
import {
    StorageInsightsDto,
    StorageMissionDto,
    StorageProjectDto,
    StorageTypeDto,
    StorageUploadersDto,
} from '@kleinkram/api-dto';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { FileState, UserRole } from '@kleinkram/shared';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/** Projects listed by name; the rest is summed up as "other" */
const TOP_PROJECTS = 6;
/** More file types than this: the smallest ones are folded into "OTHER" */
const MAX_TYPES = 5;
const TOP_MISSIONS = 5;
/** Uploaders listed by name; the rest is summed up as "other" */
const TOP_UPLOADERS = 8;

/**
 * What a user may see: for non-admins, SQL that limits the statistics to
 * the files and missions they can read, built from the same access rule as
 * the file and mission lists (`addAccessConstraintsTo…Query`).
 */
interface Scope {
    /** common table expressions `accessible_files` / `accessible_missions` */
    ctes: string[];
    /** positional parameters of the expressions */
    parameters: unknown[];
    /** `AND …` limiting a query over `file_entity f` */
    fileFilter: string;
    /** `AND …` limiting a query over `mission pm` */
    missionFilter: string;
}

const UNRESTRICTED: Scope = {
    ctes: [],
    parameters: [],
    fileFilter: '',
    missionFilter: '',
};

/** `WITH …` for the scope's expressions and the query's own ones */
const withClause = (scope: Scope, ...extra: string[]): string => {
    const all = [...scope.ctes, ...extra];
    return all.length > 0 ? `WITH ${all.join(',\n')}` : '';
};

/** PostgreSQL returns sums of bigints as strings */
type Numeric = string | number | null;
const toNumber = (value: Numeric): number => Number(value ?? 0);

/**
 * Where the stored data comes from and how it grows: totals, monthly
 * history and the largest projects, file types and missions. Everything is
 * aggregated in SQL over the files' recorded sizes.
 *
 * Only existing files (`deletedAt IS NULL`) count, except for the monthly
 * history, which also counts files deleted after the end of a month. A row
 * reserved for an upload that has not finished or was cancelled is not a
 * stored file and never counts.
 *
 * Admins see everything; everyone else only the files of projects and
 * missions they can read, the same rule as the file lists.
 */
/**
 * An upload reserves its file row (size 0) before any data exists; the row
 * stays until the upload finishes or the nightly cleanup removes it.
 */
const FINISHED_UPLOAD = `f.state NOT IN ('${FileState.UPLOADING}', '${FileState.CANCELED}')`;

/** A file that exists and counts in the statistics */
const STORED_FILE = `f."deletedAt" IS NULL AND ${FINISHED_UPLOAD}`;

@Injectable()
export class StorageInsightsService {
    constructor(
        @InjectRepository(FileEntity)
        private fileRepository: Repository<FileEntity>,
    ) {}

    async getInsights(user: UserEntity): Promise<StorageInsightsDto> {
        const scope = this.scopeOf(user);
        const [totals, recent, monthly, projects, types, missions] =
            await Promise.all([
                this.totals(scope),
                this.recent(scope),
                this.monthly(scope),
                this.projects(scope),
                this.types(scope),
                this.largestMissions(scope),
            ]);

        const otherProjects = projects.slice(TOP_PROJECTS);
        return {
            totals,
            ...recent,
            monthly,
            byProject: projects.slice(0, TOP_PROJECTS),
            otherProjects:
                otherProjects.length > 0
                    ? {
                          bytes: otherProjects.reduce(
                              (sum, project) => sum + project.bytes,
                              0,
                          ),
                          projectCount: otherProjects.length,
                      }
                    : null,
            byType: foldTypes(types),
            largestMissions: missions,
        };
    }

    /**
     * Stored data per user who uploaded it, for admins. Returns names only,
     * never email addresses.
     */
    async getUploaders(): Promise<StorageUploadersDto> {
        const rows = (await this.fileRepository.query(`
            SELECT u.uuid,
                   u.name,
                   SUM(f.size) AS bytes,
                   COUNT(*) AS "fileCount",
                   MAX(f."createdAt") AS "lastUploadAt"
            FROM file_entity f
            JOIN "user" u ON u.uuid = f."creatorUuid"
            WHERE ${STORED_FILE}
            GROUP BY u.uuid, u.name
            ORDER BY bytes DESC, u.name
        `)) as {
            uuid: string;
            name: string;
            bytes: Numeric;
            fileCount: Numeric;
            lastUploadAt: Date;
        }[];
        const uploaders = rows.map((row) => ({
            uuid: row.uuid,
            name: row.name,
            bytes: toNumber(row.bytes),
            fileCount: toNumber(row.fileCount),
            lastUploadAt: row.lastUploadAt,
        }));
        const others = uploaders.slice(TOP_UPLOADERS);
        return {
            uploaders: uploaders.slice(0, TOP_UPLOADERS),
            other:
                others.length > 0
                    ? {
                          bytes: others.reduce(
                              (sum, uploader) => sum + uploader.bytes,
                              0,
                          ),
                          userCount: others.length,
                      }
                    : null,
            totalBytes: uploaders.reduce(
                (sum, uploader) => sum + uploader.bytes,
                0,
            ),
        };
    }

    /** The files and missions the user may see, see `Scope` */
    private scopeOf(user: UserEntity): Scope {
        if (user.role === UserRole.ADMIN) return UNRESTRICTED;

        // deleted files too: the monthly history counts files deleted since
        const files = this.fileRepository
            .createQueryBuilder('file')
            .withDeleted()
            .select('file.uuid', 'uuid')
            .leftJoin('file.mission', 'mission')
            .leftJoin('mission.project', 'project');
        addAccessConstraintsToFileQuery(files, user.uuid);
        const [filesSql, fileParameters] = files.getQueryAndParameters() as [
            string,
            unknown[],
        ];

        const missions = this.fileRepository.manager
            .getRepository(MissionEntity)
            .createQueryBuilder('mission')
            .select('mission.uuid', 'uuid')
            .leftJoin('mission.project', 'project');
        addAccessConstraintsToMissionQuery(missions, user.uuid);
        const [missionsSql, missionParameters] =
            missions.getQueryAndParameters() as [string, unknown[]];
        // both expressions share one parameter list: renumber the second
        const shiftedMissionsSql = missionsSql.replaceAll(
            /\$(\d+)/g,
            (_, index: string) =>
                `$${String(Number(index) + fileParameters.length)}`,
        );

        return {
            ctes: [
                `accessible_files AS (${filesSql})`,
                `accessible_missions AS (${shiftedMissionsSql})`,
            ],
            parameters: [...fileParameters, ...missionParameters],
            fileFilter: 'AND f.uuid IN (SELECT uuid FROM accessible_files)',
            missionFilter:
                'AND pm.uuid IN (SELECT uuid FROM accessible_missions)',
        };
    }

    private async totals(scope: Scope): Promise<StorageInsightsDto['totals']> {
        const [row] = (await this.fileRepository.query(
            `
            ${withClause(scope)}
            SELECT COALESCE(SUM(f.size), 0) AS bytes,
                   COUNT(*) AS "fileCount",
                   COUNT(DISTINCT m."projectUuid") AS "projectCount"
            FROM file_entity f
            JOIN mission m ON m.uuid = f."missionUuid"
            WHERE ${STORED_FILE} ${scope.fileFilter}
        `,
            scope.parameters,
        )) as { bytes: Numeric; fileCount: Numeric; projectCount: Numeric }[];
        return {
            bytes: toNumber(row.bytes),
            fileCount: toNumber(row.fileCount),
            projectCount: toNumber(row.projectCount),
        };
    }

    /** Uploads of the last 30 and 90 days (for the growth rate) */
    private async recent(
        scope: Scope,
    ): Promise<Pick<StorageInsightsDto, 'last30Days' | 'last90Days'>> {
        const [row] = (await this.fileRepository.query(
            `
            ${withClause(scope)}
            SELECT
                COALESCE(SUM(f.size) FILTER (
                    WHERE f."createdAt" > NOW() - INTERVAL '30 days'), 0)
                    AS bytes30,
                COUNT(*) FILTER (
                    WHERE f."createdAt" > NOW() - INTERVAL '30 days')
                    AS files30,
                COALESCE(SUM(f.size) FILTER (
                    WHERE f."createdAt" > NOW() - INTERVAL '90 days'), 0)
                    AS bytes90,
                COUNT(*) FILTER (
                    WHERE f."createdAt" > NOW() - INTERVAL '90 days')
                    AS files90
            FROM file_entity f
            WHERE ${STORED_FILE} ${scope.fileFilter}
        `,
            scope.parameters,
        )) as Record<'bytes30' | 'files30' | 'bytes90' | 'files90', Numeric>[];
        return {
            last30Days: {
                bytes: toNumber(row.bytes30),
                fileCount: toNumber(row.files30),
            },
            last90Days: {
                bytes: toNumber(row.bytes90),
                fileCount: toNumber(row.files90),
            },
        };
    }

    /**
     * Bytes stored at the end of each of the last 12 calendar months: files
     * created before the month ended and not deleted by then. The current
     * month counts up to now.
     */
    private async monthly(
        scope: Scope,
    ): Promise<StorageInsightsDto['monthly']> {
        const rows = (await this.fileRepository.query(
            `
            ${withClause(
                scope,
                `months AS (
                SELECT month_start,
                       LEAST(month_start + INTERVAL '1 month', NOW())
                           AS month_end
                FROM generate_series(
                    date_trunc('month', NOW()) - INTERVAL '11 months',
                    date_trunc('month', NOW()),
                    INTERVAL '1 month'
                ) AS month_start
            )`,
            )}
            SELECT to_char(months.month_start, 'YYYY-MM') AS month,
                   COALESCE(SUM(f.size), 0) AS bytes
            FROM months
            LEFT JOIN file_entity f
                ON f."createdAt" < months.month_end
                AND (f."deletedAt" IS NULL
                     OR f."deletedAt" >= months.month_end)
                AND ${FINISHED_UPLOAD}
                ${scope.fileFilter}
            GROUP BY months.month_start
            ORDER BY months.month_start
        `,
            scope.parameters,
        )) as { month: string; bytes: Numeric }[];
        return rows.map((row) => ({
            month: row.month,
            bytes: toNumber(row.bytes),
        }));
    }

    /** All projects with files, largest first */
    private async projects(scope: Scope): Promise<StorageProjectDto[]> {
        const rows = (await this.fileRepository.query(
            `
            ${withClause(scope)}
            SELECT p.uuid,
                   p.name,
                   SUM(f.size) AS bytes,
                   (SELECT COUNT(*) FROM mission pm
                    WHERE pm."projectUuid" = p.uuid
                      AND pm."deletedAt" IS NULL
                      ${scope.missionFilter}) AS "missionCount"
            FROM file_entity f
            JOIN mission m ON m.uuid = f."missionUuid"
            JOIN project p ON p.uuid = m."projectUuid"
            WHERE ${STORED_FILE} ${scope.fileFilter}
            GROUP BY p.uuid, p.name
            ORDER BY bytes DESC, p.name
        `,
            scope.parameters,
        )) as {
            uuid: string;
            name: string;
            bytes: Numeric;
            missionCount: Numeric;
        }[];
        return rows.map((row) => ({
            uuid: row.uuid,
            name: row.name,
            bytes: toNumber(row.bytes),
            missionCount: toNumber(row.missionCount),
        }));
    }

    /** All file types, largest first */
    private async types(scope: Scope): Promise<StorageTypeDto[]> {
        const rows = (await this.fileRepository.query(
            `
            ${withClause(scope)}
            SELECT f.type, SUM(f.size) AS bytes, COUNT(*) AS "fileCount"
            FROM file_entity f
            WHERE ${STORED_FILE} ${scope.fileFilter}
            GROUP BY f.type
            ORDER BY bytes DESC, f.type
        `,
            scope.parameters,
        )) as { type: string; bytes: Numeric; fileCount: Numeric }[];
        return rows.map((row) => ({
            type: row.type,
            types: [row.type],
            bytes: toNumber(row.bytes),
            fileCount: toNumber(row.fileCount),
        }));
    }

    private async largestMissions(scope: Scope): Promise<StorageMissionDto[]> {
        const rows = (await this.fileRepository.query(
            `
            ${withClause(scope)}
            SELECT m.uuid AS "missionUuid",
                   m.name AS "missionName",
                   p.uuid AS "projectUuid",
                   p.name AS "projectName",
                   SUM(f.size) AS bytes
            FROM file_entity f
            JOIN mission m ON m.uuid = f."missionUuid"
            JOIN project p ON p.uuid = m."projectUuid"
            WHERE ${STORED_FILE} ${scope.fileFilter}
            GROUP BY m.uuid, m.name, p.uuid, p.name
            ORDER BY bytes DESC, m.name
            LIMIT ${String(TOP_MISSIONS)}
        `,
            scope.parameters,
        )) as (Omit<StorageMissionDto, 'bytes'> & { bytes: Numeric })[];
        return rows.map((row) => ({ ...row, bytes: toNumber(row.bytes) }));
    }
}

/**
 * Keeps the largest types; with more than MAX_TYPES, the smallest ones are
 * summed up as one "OTHER" entry listing them.
 */
export const foldTypes = (types: StorageTypeDto[]): StorageTypeDto[] => {
    if (types.length <= MAX_TYPES) return types;
    const kept = types.slice(0, MAX_TYPES - 1);
    const folded = types.slice(MAX_TYPES - 1);
    return [
        ...kept,
        {
            type: 'OTHER',
            types: folded.map((type) => type.type),
            bytes: folded.reduce((sum, type) => sum + type.bytes, 0),
            fileCount: folded.reduce((sum, type) => sum + type.fileCount, 0),
        },
    ];
};
