import { ApiOkResponse, OutputDto } from '@/decorators';
import { FileService } from '@/services/file.service';
import { QueueService } from '@/services/queue.service';
import {
    QueryBoolean,
    QueryDate,
    QueryOptionalDate,
    QueryOptionalRecord,
    QueryOptionalString,
    QueryOptionalUUID,
    QuerySkip,
    QuerySortBy,
    QuerySortDirection,
    QueryString,
    QueryTake,
    QueryUUID,
} from '@/validation/query-decorators';
import {
    CancelFileUploadDto,
    CancelProcessingResponseDto,
    CancelUploadResponseDto,
    ConfirmUploadDto,
    DeleteFileResponseDto,
    DeleteMissionResponseDto,
    DownloadResponseDto,
    DriveCreate,
    DriveImportResponseDto,
    FileDto,
    FileEventsDto,
    FileExistsResponseDto,
    FileQueryDto,
    FileQueueEntriesDto,
    FileQueueEntryDto,
    FilesDto,
    FileWithTopicDto,
    FoxgloveLinkResponseDto,
    IsUploadingDto,
    MoveFilesResponseDto,
    NoQueryParametersDto,
    RecalculateHashesResponseDto,
    ReextractTopicsResponseDto,
    StopJobResponseDto,
    StorageOverviewDto,
    TemporaryAccessRequestDto,
    TemporaryFileAccessesDto,
    UpdateFile,
} from '@kleinkram/api-dto';
import {
    BodyOptionalSource,
    BodyString,
    BodyUUID,
    BodyUUIDArray,
    isValidFileName,
} from '@kleinkram/validation';
import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Post,
    Put,
    Query,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import logger from '../../logger';
import { ParameterUuid as ParameterUID } from '../../validation/parameter-decorators';
import { AddUser, AuthHeader } from '../auth/parameter-decorator';
import {
    AdminOnly,
    CanCreateInMissionByBody,
    CanDeleteFile,
    CanDeleteMission,
    CanMoveFiles,
    CanReadFile,
    CanReadMission,
    CanWriteFile,
    LoggedIn,
    UserOnly,
} from '../auth/roles.decorator';

import { FoxgloveService } from '@/services/foxglove.service';
import { FileSource, HealthStatus } from '@kleinkram/shared';

@Controller(['files'])
export class FileController {
    constructor(
        private readonly fileService: FileService,
        private readonly queueService: QueueService,
        private readonly foxgloveService: FoxgloveService,
    ) {}

    @Get()
    @LoggedIn()
    @ApiOkResponse({
        description: 'Many Files',
        type: FilesDto,
    })
    async getMany(
        @Query() query: FileQueryDto,
        @AddUser() auth: AuthHeader,
    ): Promise<FilesDto> {
        // we pre-check the access to give a proper error message
        // the actual findMany method will check access again per file
        await this.fileService.checkResourceAccess(
            query.projectUuids ?? [],
            query.missionUuids ?? [],
            auth.user.uuid,
        );

        // also check access by patterns
        await this.fileService.checkResourceAccessByName(
            query.projectPatterns ?? [],
            query.missionPatterns ?? [],
            auth.user.uuid,
        );

        // now fetch files, we only query files we have access to
        return await this.fileService.findMany(
            query.projectUuids ?? [],
            query.projectPatterns ?? [],
            query.missionUuids ?? [],
            query.missionPatterns ?? [],
            query.fileUuids ?? [],
            query.filePatterns ?? [],
            query.metadata ?? {},
            query.sortBy,
            query.sortOrder,
            query.take,
            query.skip,
            auth.user.uuid,
        );
    }

    @Get('filtered')
    @LoggedIn()
    @ApiOkResponse({
        description: 'Filtered Files',
        type: FilesDto,
    })
    async filteredFiles(
        @QueryOptionalString('fileName', 'Filter for Filename')
        fileName: string,
        @QueryOptionalUUID('projectUUID', 'UUID of Project to filter by')
        projectUUID: string,
        @QueryOptionalUUID('missionUUID', 'UUID of Mission to filter by')
        missionUUID: string,
        @QueryOptionalDate(
            'startDate',
            'Date specifying the start of the filtered time range',
        )
        startDate: Date | undefined,
        @QueryOptionalDate(
            'endDate',
            'Date specifying the end of the filtered time range',
        )
        endDate: Date | undefined,
        @QueryOptionalString('topics', 'Name of Topics (coma separated)')
        topics: string,
        @QueryOptionalString(
            'messageDatatypes',
            'Message datatypes to filter by (coma separated). If multiple are given, ' +
                'files containing any of the datatypes are returned (OR).',
        )
        messageDatatypes: string,
        @QueryOptionalString(
            'fileTypes',
            'File types to filter by (coma separated)',
        )
        fileTypes: string,
        @QueryOptionalString(
            'categories',
            'Categories to filter by (coma separated)',
        )
        categories: string,
        @QueryBoolean(
            'matchAllTopics',
            'Returned File needs all specified topics (true) or any specified topics (false)',
        )
        matchAllTopics: boolean,
        @QueryOptionalRecord('tags', 'Dictionary Tagtype name to Tag value') // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tags: Record<string, any>,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @QuerySortBy('sort') sort: string,
        @QuerySortDirection('sortDirection') sortDirection: 'ASC' | 'DESC',
        @QueryOptionalString('health', 'File health') health: HealthStatus,
        @AddUser() auth: AuthHeader,
    ): Promise<FilesDto> {
        let _missionUUID = missionUUID;
        if (auth.apiKey) {
            _missionUUID = auth.apiKey.mission.uuid;
        }
        return await this.fileService.findFiltered(
            fileName,
            projectUUID,
            _missionUUID,
            startDate,
            endDate,
            topics,
            messageDatatypes,
            categories,
            matchAllTopics,
            fileTypes,
            tags, // todo check if this is correct
            auth.user.uuid,
            Number.parseInt(String(take)), // TODO: fix
            Number.parseInt(String(skip)), // TODO: fix
            sort,
            sortDirection,
            health,
        );
    }

    @Get('download')
    @CanReadFile()
    @ApiOkResponse({
        description: 'Download link',
        type: DownloadResponseDto,
    })
    async download(
        @QueryUUID('uuid', 'File UUID') uuid: string,
        @QueryBoolean(
            'expires',
            'Whether the download link should stay valid for on week (false) or 4h (true)',
        )
        expires: boolean,

        @QueryBoolean(
            'preview_only',
            'Whether the download link is for preview only (true) or full download (false)',
        )
        previewOnly = false,
        @AddUser() auth: AuthHeader,
    ): Promise<DownloadResponseDto> {
        logger.debug(`download ${uuid}: expires=${expires.toString()}`);
        const url = await this.fileService.generateDownload(
            uuid,
            expires,
            previewOnly,
            auth.user,
            auth.apiKey?.action,
        );
        return { url };
    }

    // TODO: replace this with /file/:uuid
    @Get('one')
    @CanReadFile()
    @ApiOkResponse({
        description: 'File',
        type: FileWithTopicDto,
    })
    async getFileById(
        @QueryUUID('uuid', 'File UUID') uuid: string,
    ): Promise<FileWithTopicDto> {
        const file = await this.fileService.findOne(uuid);
        return plainToInstance(FileWithTopicDto, file, {
            excludeExtraneousValues: true,
        });
    }

    @Put(':uuid')
    @CanWriteFile()
    @ApiOkResponse({
        description: 'File',
        type: FileDto,
    })
    async update(
        @ParameterUID('uuid') uuid: string,
        @Body() dto: UpdateFile,
        @AddUser() auth: AuthHeader,
    ): Promise<FileDto> {
        const file = await this.fileService.update(
            uuid,
            dto,
            auth.user,
            auth.apiKey?.action,
        );
        return plainToInstance(FileDto, file, {
            excludeExtraneousValues: true,
        });
    }

    @Post('moveFiles')
    @CanMoveFiles()
    @ApiOkResponse({
        description: 'Move Files Response',
        type: MoveFilesResponseDto,
    })
    async moveFiles(
        @BodyUUIDArray('fileUUIDs', 'List of File UUID to be moved')
        fileUUIDs: string[],
        @BodyUUID('missionUUID', 'UUID of target Mission') missionUUID: string,
        @AddUser() auth: AuthHeader,
    ): Promise<MoveFilesResponseDto> {
        await this.fileService.moveFiles(
            fileUUIDs,
            missionUUID,
            auth.user,
            auth.apiKey?.action,
        );
        return { success: true };
    }

    @Get('oneByName')
    @CanReadMission()
    @ApiOkResponse({
        description: 'File',
        type: FileDto,
    })
    async getOneFileByName(
        @QueryUUID('uuid', 'Mission UUID to search in') uuid: string,
        @QueryString('filename', 'Filename searched for') name: string,
    ): Promise<FileDto> {
        const file = await this.fileService.findOneByName(uuid, name);
        return plainToInstance(FileDto, file, {
            excludeExtraneousValues: true,
        });
    }

    @Delete(':uuid')
    @CanDeleteFile()
    @OutputDto(DeleteFileResponseDto)
    async deleteFile(
        @ParameterUID('uuid') uuid: string,
        @AddUser() auth: AuthHeader,
    ): Promise<DeleteFileResponseDto> {
        await this.fileService.deleteFile(uuid, auth.user, auth.apiKey?.action);
        return { success: true };
    }

    @Get('storage')
    @ApiOkResponse({
        description: 'Storage information',
        type: StorageOverviewDto,
    })
    @LoggedIn()
    async getStorage(): Promise<StorageOverviewDto> {
        return this.fileService.getStorage();
    }

    @Get('isUploading')
    @LoggedIn()
    @ApiOkResponse({
        description: 'Indicates if the current API user is uplaoding any files',
        type: IsUploadingDto,
    })
    async isUploading(
        @Query() _query: NoQueryParametersDto,
        @AddUser() auth: AuthHeader,
    ): Promise<IsUploadingDto> {
        return {
            isUploading: await this.fileService.isUploading(auth.user.uuid),
        };
    }

    @Post('temporaryAccess')
    @CanCreateInMissionByBody()
    @ApiOkResponse({
        description: 'Temporary file access',
        type: TemporaryFileAccessesDto,
    })
    async getTemporaryAccess(
        @AddUser() auth: AuthHeader,
        @Body() body: TemporaryAccessRequestDto,
    ): Promise<TemporaryFileAccessesDto> {
        let source = body.source;
        if (!source) {
            source = FileSource.WEB_INTERFACE;
            if (auth.apiKey) {
                source = auth.apiKey.action
                    ? FileSource.ACTION
                    : FileSource.CLI;
            }
        }

        const invalidFiles: { filename: string; error: string }[] = [];
        for (const filename of body.filenames) {
            if (!isValidFileName(filename)) {
                invalidFiles.push({
                    filename,
                    error: `Filename "${filename}" is not valid!`,
                });
            }
        }

        if (invalidFiles.length > 0) {
            throw new BadRequestException({
                message: 'Validation failed',
                errors: invalidFiles,
            });
        }

        return await this.fileService.getTemporaryAccess(
            body.filenames,
            body.missionUUID,
            auth.user.uuid,
            auth.apiKey?.action,
            source,
        );
    }

    @Post('cancelUpload')
    @UserOnly() //Push back authentication to the queue to accelerate the request
    @OutputDto(CancelUploadResponseDto)
    async cancelUpload(
        @Body() dto: CancelFileUploadDto,
        @AddUser() auth: AuthHeader,
    ): Promise<CancelUploadResponseDto> {
        logger.debug(`cancelUpload ${JSON.stringify(dto)}`);
        await this.fileService.cancelUpload(
            dto.uuids,
            dto.missionUuid,
            auth.user.uuid,
        );
        return { success: true };
    }

    @Post('deleteMultiple')
    @CanDeleteMission()
    @ApiOkResponse({
        description: 'Delete Files Response',
        type: DeleteFileResponseDto,
    })
    async deleteMultiple(
        @BodyUUIDArray('uuids', 'List of File UUID to be deleted')
        uuids: string[],
        @BodyUUID('missionUUID', 'Mission UUID') missionUUID: string,
    ): Promise<DeleteFileResponseDto> {
        await this.fileService.deleteMultiple(uuids, missionUUID);
        return { success: true };
    }

    @Get('exists')
    @CanReadFile()
    @ApiOkResponse({
        description: 'File exists',
        type: FileExistsResponseDto,
    })
    async exists(
        @QueryUUID('uuid', 'FileUUID searched') uuid: string,
    ): Promise<FileExistsResponseDto> {
        return this.fileService.exists(uuid);
    }

    @Post('resetMinioTags')
    @AdminOnly()
    @ApiOkResponse({
        description: 'Resetting Minio tags completed',
    })
    async resetMinioTags(): Promise<void> {
        logger.debug('Resetting S3 tags');
        await this.fileService.renameTags();
        logger.debug('Resetting S3 tags done');
    }

    @Post('recomputeFileSizes')
    @AdminOnly()
    @ApiOkResponse({
        description: 'Recomputing file sizes completed',
    })
    async recomputeFileSizes(): Promise<void> {
        logger.debug('Recomputing file sizes');
        await this.fileService.recomputeFileSizes();
        logger.debug('Recomputing file sizes done');
    }

    @Get(':uuid/events')
    @CanReadFile()
    @ApiOkResponse({
        description: 'Get history/events for a file',
        type: FileEventsDto,
    })
    async getEvents(
        @ParameterUID('uuid') uuid: string,
    ): Promise<FileEventsDto> {
        return this.fileService.getFileEvents(uuid);
    }

    @Post('reextractTopics')
    @AdminOnly()
    @ApiOkResponse({
        description: 'Reextracting topics completed',
        type: ReextractTopicsResponseDto,
    })
    async reextractTopics(): Promise<ReextractTopicsResponseDto> {
        logger.debug('Triggering manual topic extraction for missing files');
        const count = await this.fileService.reextractMissingTopics();
        return { count };
    }

    @Get(':uuid/foxglove-link')
    @CanReadFile()
    @ApiOkResponse({
        description: 'Generates a signed link for Foxglove Studio.',
        type: FoxgloveLinkResponseDto,
    })
    async getFoxgloveLink(
        @ParameterUID('uuid') uuid: string,
        @AddUser() auth: AuthHeader,
    ): Promise<{ url: string }> {
        const url = await this.foxgloveService.generateFoxgloveUrl(
            uuid,
            auth.user,
        );
        return { url };
    }

    @Post('import/drive')
    @CanCreateInMissionByBody()
    @OutputDto(DriveImportResponseDto)
    async importFromDrive(
        @Body() body: DriveCreate,
        @AddUser() authHeader: AuthHeader,
    ): Promise<DriveImportResponseDto> {
        await this.queueService.importFromDrive(body, authHeader.user);
        return {
            success: true,
        };
    }

    @Post('upload/confirm')
    @LoggedIn()
    @ApiOkResponse({
        type: ConfirmUploadDto,
    })
    async confirmUpload(
        @BodyUUID('uuid', 'File UUID of file that successfully uploaded')
        uuid: string,
        @BodyString('md5', 'MD5 hash to validate uncorrupted upload')
        md5: string,
        @BodyOptionalSource(
            'source',
            'Source of the upload (CLI, Web Interface, etc.)',
        )
        source: FileSource | undefined,
        @AddUser() auth: AuthHeader,
    ): Promise<ConfirmUploadDto> {
        let _source = source;
        if (!_source) {
            _source = FileSource.WEB_INTERFACE;
            if (auth.apiKey) {
                _source = auth.apiKey.action
                    ? FileSource.ACTION
                    : FileSource.CLI;
            }
        }
        await this.queueService.confirmUpload(uuid, md5, auth.user, _source);
        return {
            success: true,
        };
    }

    @Post('maintenance/recalculate-hashes')
    @AdminOnly()
    @ApiOkResponse({
        description: 'Recalculating hashes completed',
        type: RecalculateHashesResponseDto,
    })
    async recalculateHashes(): Promise<RecalculateHashesResponseDto> {
        return await this.queueService.recalculateHashes();
    }

    @Get('queue')
    @LoggedIn()
    @ApiOkResponse({
        type: FileQueueEntriesDto,
    })
    async active(
        @QueryDate('startDate', 'Start of time range to filter queue by')
        startDate: string,
        @QueryOptionalString('stateFilter', 'State of QueueEntity to filter by')
        stateFilter: string,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @AddUser() user: AuthHeader,
    ): Promise<FileQueueEntriesDto> {
        const date = new Date(startDate);
        if (Number.isNaN(date.getTime())) {
            throw new BadRequestException(
                `Invalid startDate: "${startDate}". Expected ISO 8601 format.`,
            );
        }

        const data = (await this.queueService.active(
            date,
            stateFilter,
            user.user.uuid,
            skip,
            take,
        )) as unknown as FileQueueEntryDto[];

        return plainToInstance(
            FileQueueEntriesDto,
            {
                data,
                // TODO: implenment count in queue Service
                count: data.length,
                skip,
                take,
            },
            { excludeExtraneousValues: true },
        );
    }

    @Delete('queue/:uuid')
    @CanDeleteMission()
    @ApiOkResponse({
        type: DeleteMissionResponseDto,
    })
    async deleteQueueItem(
        @BodyUUID('missionUUID', 'Mission UUID') missionUUID: string,
        @ParameterUID('uuid') uuid: string,
    ): Promise<DeleteMissionResponseDto> {
        return this.queueService.delete(missionUUID, uuid);
    }

    @Post('queue/:uuid/cancel')
    @CanDeleteMission()
    @ApiOkResponse({
        type: CancelProcessingResponseDto,
    })
    async cancelProcessing(
        @ParameterUID('uuid') queueUUID: string,
        @BodyUUID('missionUUID', 'Mission UUID of Queue') missionUUID: string,
    ): Promise<CancelProcessingResponseDto> {
        return this.queueService.cancelProcessing(queueUUID, missionUUID);
    }

    @Post('queue/:uuid/stop')
    @CanDeleteMission()
    @ApiOkResponse({
        type: StopJobResponseDto,
    })
    async stopJob(
        @ParameterUID('uuid') queueUUID: string,
    ): Promise<StopJobResponseDto> {
        await this.queueService.stopJob(queueUUID);
        return { success: true };
    }
}
