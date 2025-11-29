import { CreatePreSignedURLSDto } from '@common/api/types/create-pre-signed-url.dto';
import {
    FileExistsResponseDto,
    TemporaryFileAccessesDto,
} from '@common/api/types/file/access.dto';
import { FileWithTopicDto } from '@common/api/types/file/file.dto';
import { FilesDto } from '@common/api/types/file/files.dto';
import { IsUploadingDto } from '@common/api/types/file/is-uploading.dto';
import { NoQueryParametersDto } from '@common/api/types/no-query-parameters.dto';
import { StorageOverviewDto } from '@common/api/types/storage-overview.dto';
import { UpdateFile } from '@common/api/types/update-file.dto';
import env from '@common/environment';
import {
    Body,
    Controller,
    Delete,
    Get,
    Post,
    Put,
    Query,
} from '@nestjs/common';
import { ApiOkResponse, OutputDto } from '../../decarators';
import logger from '../../logger';
import { FileService } from '../../services/file.service';
import { BodyUUID, BodyUUIDArray } from '../../validation/body-decorators';
import { ParameterUuid as ParameterUID } from '../../validation/parameter-decorators';
import {
    QueryBoolean,
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
} from '../../validation/query-decorators';
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

import { CancelFileUploadDto } from '@common/api/types/cancel-file-upload.dto';
import { FileEventsDto } from '@common/api/types/file/file-event.dto';
import { FileQueryDto } from '@common/api/types/file/file-query.dto';
import { FoxgloveLinkResponseDto } from '@common/api/types/file/foxglove-link-response.dto';
import FileEntity from '@common/entities/file/file.entity';
import { FileSource, HealthStatus } from '@common/frontend_shared/enum';
import { FoxgloveService } from '../../services/foxglove.service';

@Controller(['files'])
export class FileController {
    constructor(
        private readonly fileService: FileService,
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
        @QueryOptionalRecord('tags', 'Dictionary Tagtype name to Tag value')
        tags: Record<string, any>,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @QuerySortBy('sort') sort: string,
        @QuerySortDirection('sortDirection') sortDirection: 'ASC' | 'DESC',
        @QueryOptionalString('health', 'File health') health: HealthStatus,
        @AddUser() auth: AuthHeader,
    ): Promise<FilesDto> {
        let _missionUUID = missionUUID;
        if (auth.apikey) {
            _missionUUID = auth.apikey.mission.uuid;
        }
        return await this.fileService.findFiltered(
            fileName,
            projectUUID,
            _missionUUID,
            startDate,
            endDate,
            topics,
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
    @OutputDto(null) // TODO: type API response
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
        preview_only = false,
        @AddUser() auth: AuthHeader,
    ): Promise<string> {
        logger.debug(`download ${uuid}: expires=${expires.toString()}`);
        return this.fileService.generateDownload(
            uuid,
            expires,
            preview_only,
            auth.user,
            auth.apikey?.action,
        );
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
        return this.fileService.findOne(uuid);
    }

    @Put(':uuid')
    @CanWriteFile()
    @OutputDto(null) // TODO: type API response
    async update(
        @ParameterUID('uuid') uuid: string,
        @Body() dto: UpdateFile,
        @AddUser() auth: AuthHeader,
    ): Promise<FileEntity | null> {
        return this.fileService.update(
            uuid,
            dto,
            auth.user,
            auth.apikey?.action,
        );
    }

    @Post('moveFiles')
    @CanMoveFiles()
    @OutputDto(null) // TODO: type API response
    async moveFiles(
        @BodyUUIDArray('fileUUIDs', 'List of File UUID to be moved')
        fileUUIDs: string[],
        @BodyUUID('missionUUID', 'UUID of target Mission') missionUUID: string,
        @AddUser() auth: AuthHeader,
    ): Promise<void> {
        return this.fileService.moveFiles(
            fileUUIDs,
            missionUUID,
            auth.user,
            auth.apikey?.action,
        );
    }

    @Get('oneByName')
    @CanReadMission()
    @OutputDto(null) // TODO: type API response
    async getOneFileByName(
        @QueryUUID('uuid', 'Mission UUID to search in') uuid: string,
        @QueryString('filename', 'Filename searched for') name: string,
    ): Promise<FileEntity | null> {
        return this.fileService.findOneByName(uuid, name);
    }

    @Delete(':uuid')
    @CanDeleteFile()
    @OutputDto(null) // TODO: type API response
    async deleteFile(
        @ParameterUID('uuid') uuid: string,
        @AddUser() auth: AuthHeader,
    ): Promise<void> {
        await this.fileService.deleteFile(uuid, auth.user, auth.apikey?.action);
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
    @OutputDto(null) // TODO: type API response
    async getTemporaryAccess(
        @AddUser() auth: AuthHeader,
        @Body() body: CreatePreSignedURLSDto,
    ): Promise<TemporaryFileAccessesDto> {
        let source = body.source;
        if (!source) {
            source = FileSource.WEB_INTERFACE;
            if (auth.apikey) {
                source = auth.apikey.action
                    ? FileSource.ACTION
                    : FileSource.CLI;
            }
        }
        return await this.fileService.getTemporaryAccess(
            body.filenames,
            body.missionUUID,
            auth.user.uuid,
            auth.apikey?.action,
            source,
        );
    }

    @Post('cancelUpload')
    @UserOnly() //Push back authentication to the queue to accelerate the request
    @OutputDto(null) // TODO: type API response
    async cancelUpload(
        @Body() dto: CancelFileUploadDto,
        @AddUser() auth: AuthHeader,
    ): Promise<void> {
        logger.debug(`cancelUpload ${dto.uuids.toString()}`);
        await this.fileService.cancelUpload(
            dto.uuids,
            dto.missionUuid,
            auth.user.uuid,
        );
    }

    @Post('deleteMultiple')
    @CanDeleteMission()
    @OutputDto(null) // TODO: type API response
    async deleteMultiple(
        @BodyUUIDArray('uuids', 'List of File UUID to be deleted')
        uuids: string[],
        @BodyUUID('missionUUID', 'Mission UUID') missionUUID: string,
    ): Promise<void> {
        return this.fileService.deleteMultiple(uuids, missionUUID);
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
        logger.debug('Resetting Minio tags');
        await this.fileService.renameTags(env.MINIO_DATA_BUCKET_NAME);
        logger.debug('Resetting Minio tags done');
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
    @OutputDto(null) // TODO: type API response
    async reextractTopics(): Promise<{ count: number }> {
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
}
