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
import { FileType } from '@common/frontend_shared/enum';
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
    QueryOptionalStringArray,
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
import { FileQueryDto } from '@common/api/types/file/file-query.dto';

@Controller(['file', 'files']) // TODO: migrate to 'files'
export class FileController {
    constructor(private readonly fileService: FileService) {}

    @Get()
    @LoggedIn()
    @ApiOkResponse({
        description: 'Many Files',
        type: FilesDto,
    })
    async getMany(@Query() query: FileQueryDto, @AddUser() auth: AuthHeader) {
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
            "Filetypes: 'bag' | 'mcap' | 'bag,mcap' ",
        )
        fileTypes: string,
        @QueryBoolean(
            'andOr',
            'Returned File needs all specified topics (true) or any specified topics (false)',
        )
        andOr: boolean,
        @QueryOptionalRecord('tags', 'Dictionary Tagtype name to Tag value')
        tags: Record<string, any>,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @QuerySortBy('sort') sort: string,
        @QuerySortDirection('sortDirection') sortDirection: 'ASC' | 'DESC',
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
            andOr,
            fileTypes,
            tags, // todo check if this is correct
            auth.user.uuid,
            Number.parseInt(String(take)), // TODO: fix
            Number.parseInt(String(skip)), // TODO: fix
            sort,
            sortDirection,
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
    ) {
        logger.debug(`download ${uuid}: expires=${expires.toString()}`);
        return this.fileService.generateDownload(uuid, expires);
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

    @Get('ofMission')
    @CanReadMission()
    @ApiOkResponse({
        description: 'Files of a Mission',
        type: FilesDto,
    })
    async getFilesOfMission(
        @QueryUUID('uuid', 'File UUID') uuid: string,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @QueryOptionalString('filename', 'Filename filter') filename: string,
        @QueryOptionalString('fileType', 'Filetype filter') fileType: string,
        @QueryOptionalStringArray(
            'categories',
            'Categories to filter by (logical OR)',
        )
        categories: string[],
        @QuerySortBy('sort') sort: string,
        @QuerySortDirection('sortDirection') sortDirection: 'ASC' | 'DESC',
        @QueryOptionalString('health', 'File health') health: string,
    ): Promise<FilesDto> {
        return this.fileService.findByMission(
            uuid,
            Number.parseInt(String(take)), // TODO: fix
            Number.parseInt(String(skip)), // TODO: fix
            filename,
            // TODO: fix the following, it's ugly
            fileType === '' ? FileType.ALL : (fileType as FileType),
            categories,
            sort,
            sortDirection,
            health,
        );
    }

    @Put(':uuid')
    @CanWriteFile()
    @OutputDto(null) // TODO: type API response
    async update(@ParameterUID('uuid') uuid: string, @Body() dto: UpdateFile) {
        return this.fileService.update(uuid, dto);
    }

    @Post('moveFiles')
    @CanMoveFiles()
    @OutputDto(null) // TODO: type API response
    async moveFiles(
        @BodyUUIDArray('fileUUIDs', 'List of File UUID to be moved')
        fileUUIDs: string[],
        @BodyUUID('missionUUID', 'UUID of target Mission') missionUUID: string,
    ) {
        return this.fileService.moveFiles(fileUUIDs, missionUUID);
    }

    @Get('oneByName')
    @CanReadMission()
    @OutputDto(null) // TODO: type API response
    async getOneFileByName(
        @QueryUUID('uuid', 'Mission UUID to search in') uuid: string,
        @QueryString('filename', 'Filename searched for') name: string,
    ) {
        return this.fileService.findOneByName(uuid, name);
    }

    @Delete(':uuid')
    @CanDeleteFile()
    @OutputDto(null) // TODO: type API response
    async deleteFile(@ParameterUID('uuid') uuid: string): Promise<void> {
        await this.fileService.deleteFile(uuid);
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
        return await this.fileService.getTemporaryAccess(
            body.filenames,
            body.missionUUID,
            auth.user.uuid,
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
    async resetMinioTags() {
        logger.debug('Resetting Minio tags');
        await this.fileService.renameTags(env.MINIO_BAG_BUCKET_NAME);
        await this.fileService.renameTags(env.MINIO_MCAP_BUCKET_NAME);
        logger.debug('Resetting Minio tags done');
    }

    @Post('recomputeFileSizes')
    @AdminOnly()
    @ApiOkResponse({
        description: 'Recomputing file sizes completed',
    })
    async recomputeFileSizes() {
        logger.debug('Recomputing file sizes');
        await this.fileService.recomputeFileSizes();
        logger.debug('Recomputing file sizes done');
    }
}
