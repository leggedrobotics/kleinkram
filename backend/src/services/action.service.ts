import { addAccessConstraints } from '@/endpoints/auth/auth-helper';
import { AuthHeader } from '@/endpoints/auth/parameter-decorator';
import { actionEntityToDto } from '@/serialization/action';
import {
    ActionDto,
    ActionLogsDto,
    ActionQuery,
    ActionsDto,
    ActionSubmitResponseDto,
    PaginatedQueryDto,
    SubmitActionDto,
    SubmitActionMulti,
} from '@kleinkram/api-dto';
import { ApiKeyEntity } from '@kleinkram/backend-common';
import { ActionEntity } from '@kleinkram/backend-common/entities/action/action.entity';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import environment from '@kleinkram/backend-common/environment';
import { ActionDispatcherService } from '@kleinkram/backend-common/modules/action-dispatcher/action-dispatcher.service';
import { StorageService } from '@kleinkram/backend-common/modules/storage/storage.service';
import { ArtifactState, LogType, UserRole } from '@kleinkram/shared';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import {
    Brackets,
    EntityManager,
    Repository,
    SelectQueryBuilder,
} from 'typeorm';
import logger from '../logger';

interface LokiStream {
    stream: Record<string, string>;
    values: [string, string][];
}

interface LokiResponse {
    status: string;
    data: {
        resultType: string;
        result: LokiStream[];
    };
}

@Injectable()
export class ActionService {
    constructor(
        @InjectRepository(ActionEntity)
        private actionRepository: Repository<ActionEntity>,
        @InjectRepository(UserEntity)
        private userRepository: Repository<UserEntity>,
        @InjectRepository(ApiKeyEntity)
        private apikeyRepository: Repository<ApiKeyEntity>,
        @InjectRepository(MissionEntity)
        private missionRepository: Repository<MissionEntity>,

        private readonly actionDispatcher: ActionDispatcherService,
        private readonly storageService: StorageService,
    ) {}

    async submit(
        data: SubmitActionDto,
        auth: AuthHeader,
    ): Promise<ActionSubmitResponseDto> {
        const creator = await this.userRepository.findOneOrFail({
            where: { uuid: auth.user.uuid },
        });

        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: data.missionUUID },
        });

        const actionUUID = await this.actionDispatcher.dispatch(
            data.templateUUID,
            mission,
            creator,
            {},
        );

        return { actionUUID };
    }

    async multiSubmit(
        data: SubmitActionMulti,
        user: AuthHeader,
    ): Promise<ActionSubmitResponseDto[]> {
        return Promise.all(
            data.missionUUIDs.map((uuid) =>
                this.submit(
                    { missionUUID: uuid, templateUUID: data.templateUUID },
                    user,
                ),
            ),
        );
    }

    async findAll(query: ActionQuery, auth: AuthHeader): Promise<ActionsDto> {
        const {
            skip,
            take,
            sortBy,
            sortDirection,
            search,
            projectUuid,
            missionUuid,
            states,
        } = query;
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: auth.user.uuid },
        });
        const isAdmin = user.role === UserRole.ADMIN;

        const qb = this.buildBaseActionQuery();

        // Standard Filters
        if (projectUuid)
            qb.andWhere('project.uuid = :projectUuid', { projectUuid });
        if (missionUuid)
            qb.andWhere('mission.uuid = :missionUuid', { missionUuid });
        if (search) this.applySearchFilter(qb, search);

        // State Filter (Replaces /running endpoint)
        if (states) {
            qb.andWhere('action.state IN (:...states)', { states });
        }

        if (query.templateName) {
            qb.andWhere('template.name ILIKE :templateName', {
                templateName: `%${query.templateName}%`,
            });
        }

        // Sorting
        if (
            sortBy &&
            sortDirection &&
            ['ASC', 'DESC'].includes(sortDirection)
        ) {
            if (sortBy.includes('.')) {
                qb.orderBy(sortBy, sortDirection as 'ASC' | 'DESC');
            } else {
                qb.orderBy(`action.${sortBy}`, sortDirection as 'ASC' | 'DESC');
            }
        } else {
            // Default sort: newest first
            qb.orderBy('action.createdAt', 'DESC');
        }

        // Security
        if (!isAdmin) {
            addAccessConstraints(qb, auth.user.uuid);
        }

        const [actions, count] = await qb
            .skip(skip)
            .take(take)
            .getManyAndCount();

        return {
            count,
            skip: skip ?? 0,
            take: take ?? count,
            data: actions.map((element) => actionEntityToDto(element)),
        };
    }

    async details(actionUuid: string): Promise<ActionDto> {
        const action = await this.actionRepository.findOneOrFail({
            where: { uuid: actionUuid },
            relations: [
                'mission',
                'mission.project',
                'creator',
                'template',
                'template.creator',
                'worker',
            ],
        });

        const dto = actionEntityToDto(action);

        if (action.artifacts === ArtifactState.UPLOADED) {
            dto.artifactUrl = await this.generateArtifactUrl(
                dto.artifactUrl,
                action,
            );
        }

        return dto;
    }

    async getLogs(
        actionUuid: string,
        query: PaginatedQueryDto,
    ): Promise<ActionLogsDto> {
        const action = await this.actionRepository.findOneOrFail({
            where: { uuid: actionUuid },
            select: ['uuid', 'createdAt', 'executionEndedAt'],
        });

        const start = action.createdAt.getTime() * 1_000_000; // Nanoseconds
        // Add 1 minute buffer to end time or use current time if running
        const end =
            (action.executionEndedAt?.getTime() ?? Date.now()) * 1_000_000 +
            60_000_000_000;

        let logQl = `{job="queue-consumer", action_run_uuid="${actionUuid}"}`;
        if (query.search) {
            logQl += ` |= "${query.search}"`;
        }
        if (query.level) {
            // Filter by level (stdout/stderr)
            // Assuming log ingestion structures it as JSON with "type" field
            logQl += ` | json | type="${query.level}"`;
        }

        try {
            let response;
            try {
                response = await axios.get<LokiResponse>(
                    'http://loki:3100/loki/api/v1/query_range',
                    {
                        params: {
                            query: logQl,
                            start: start.toString(),
                            end: end.toString(),
                            limit: 50_000,
                            direction: 'FORWARD',
                        },
                    },
                );
            } catch (error) {
                if (
                    axios.isAxiosError(error) &&
                    error.response?.status === 400
                ) {
                    logger.warn(
                        `Loki query with limit 50000 failed, retrying with 5000. Verify Loki config "max_entries_limit_per_query".`,
                    );
                    response = await axios.get<LokiResponse>(
                        'http://loki:3100/loki/api/v1/query_range',
                        {
                            params: {
                                query: logQl,
                                start: start.toString(),
                                end: end.toString(),
                                limit: 5000,
                                direction: 'FORWARD',
                            },
                        },
                    );
                } else {
                    throw error;
                }
            }

            const result = response.data.data.result;
            const streams: LokiStream[] = Array.isArray(result) ? result : [];

            // Flatten all streams
            const allLogs = streams.flatMap((stream) =>
                stream.values.map((value) => {
                    const [tsNs, lineJson] = value;
                    try {
                        const parsed = JSON.parse(lineJson) as unknown;

                        if (
                            typeof parsed !== 'object' ||
                            parsed === null ||
                            !('message' in parsed) ||
                            typeof (parsed as { message: unknown }).message !==
                                'string'
                        ) {
                            throw new Error('Invalid log format');
                        }

                        const validParsed = parsed as {
                            timestamp?: string;
                            message: string;
                            type?: LogType;
                        };

                        return {
                            timestamp:
                                validParsed.timestamp ??
                                new Date(
                                    Number.parseInt(tsNs.slice(0, 13)),
                                ).toISOString(),
                            message: validParsed.message,
                            type: validParsed.type ?? ('stdout' as LogType),
                        };
                    } catch {
                        return {
                            timestamp: new Date(
                                Number.parseInt(tsNs.slice(0, 13)),
                            ).toISOString(),
                            message:
                                typeof lineJson === 'string'
                                    ? lineJson
                                    : JSON.stringify(lineJson),
                            type: 'stdout' as LogType,
                        };
                    }
                }),
            );

            // Sort by timestamp (Loki might return multiple streams interleaved)
            allLogs.sort(
                (a, b) =>
                    new Date(a.timestamp).getTime() -
                    new Date(b.timestamp).getTime(),
            );

            const count = allLogs.length;
            const data = allLogs.slice(query.skip, query.skip + query.take);

            return {
                count,
                skip: query.skip,
                take: query.take,
                data,
            };
        } catch (error) {
            logger.error(
                `Failed to fetch logs from Loki for ${actionUuid}: ${String(
                    error,
                )}`,
            );
            return {
                count: 0,
                skip: query.skip,
                take: query.take,
                data: [],
            };
        }
    }

    async delete(actionUUID: string): Promise<boolean> {
        await this.actionRepository.delete(actionUUID);
        return true;
    }

    async writeAuditLog(
        apiKey: string,
        auditLog: { method: string; url: string; message?: string },
        fileUuid?: string,
    ): Promise<void> {
        await this.apikeyRepository.manager.transaction(
            async (manager: EntityManager): Promise<void> => {
                const key: ApiKeyEntity = await manager.findOneOrFail(
                    ApiKeyEntity,
                    {
                        where: { apikey: apiKey },
                        relations: ['action'],
                    },
                );

                const action: ActionEntity | undefined = key.action;
                if (action === undefined) return;

                if (fileUuid) {
                    try {
                        const file = await manager.findOne(FileEntity, {
                            where: { uuid: fileUuid },
                            select: ['size'],
                        });
                        if (file?.size && file.size > 0) {
                            auditLog.message = `Downloaded ${file.size.toString()}`;
                        }
                    } catch (error) {
                        logger.warn(
                            `Failed to fetch file size for audit log: ${String(error)}`,
                        );
                    }
                }

                action.auditLogs ??= [];
                action.auditLogs.push(auditLog);
                await manager.save(action);
            },
        );
    }

    private buildBaseActionQuery(): SelectQueryBuilder<ActionEntity> {
        return this.actionRepository
            .createQueryBuilder('action')
            .leftJoinAndSelect('action.mission', 'mission')
            .leftJoinAndSelect('mission.project', 'project')
            .leftJoinAndSelect('action.template', 'template')
            .leftJoinAndSelect('template.creator', 'templateCreator')
            .leftJoinAndSelect('action.creator', 'creator');
    }

    private applySearchFilter(
        qb: SelectQueryBuilder<ActionEntity>,
        search: string,
    ): void {
        qb.andWhere(
            new Brackets((sub) => {
                sub.where('template.name ILIKE :searchTerm', {
                    searchTerm: `%${search}%`,
                })
                    .orWhere('action.state_cause ILIKE :searchTerm', {
                        searchTerm: `%${search}%`,
                    })
                    .orWhere('template.image_name ILIKE :searchTerm', {
                        searchTerm: `%${search}%`,
                    });
            }),
        );
    }

    private async generateArtifactUrl(
        currentUrl: string,
        action: ActionEntity,
    ): Promise<string> {
        const bucketName = environment.MINIO_ARTIFACTS_BUCKET_NAME;

        if (currentUrl && !currentUrl.includes(bucketName)) {
            return currentUrl;
        }

        try {
            const friendlyFilename = `${action.template?.name ?? 'artifact'}-${action.uuid}.tar.gz`;

            return await this.storageService.getPresignedDownloadUrl(
                bucketName,
                `${action.uuid}.tar.gz`,
                4 * 60 * 60,
                {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'response-content-disposition': `attachment; filename="${friendlyFilename}"`,
                },
            );
        } catch (error) {
            logger.error(
                `Failed to generate presigned URL for action ${action.uuid}:`,
                error,
            );
            return '';
        }
    }
}
