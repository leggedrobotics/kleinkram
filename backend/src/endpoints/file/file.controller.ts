import {
    Body,
    Controller,
    Delete,
    Get,
    Post,
    Put,
    Query,
} from '@nestjs/common';
import { FileService } from '../../services/file.service';
import { UpdateFile } from '@common/api/types/update-file.dto';
import logger from '../../logger';
import {
    AdminOnly,
    CanCreateInMissionByBody,
    CanDeleteFile,
    CanDeleteMission,
    CanMoveFiles,
    CanReadFile,
    CanReadFileByName,
    CanReadMission,
    CanWriteFile,
    LoggedIn,
    UserOnly,
} from '../auth/roles.decorator';
import {
    QueryBoolean,
    QueryOptionalDate,
    QueryOptionalRecord,
    QueryOptionalString,
    QueryOptionalStringArray,
    QueryOptionalUUIDArray,
    QueryOptionalUUID,
    QuerySkip,
    QuerySortBy,
    QuerySortDirection,
    QueryString,
    QueryTake,
    QueryUUID,
} from '../../validation/query-decorators';
import { ParameterUuid as ParameterUID } from '../../validation/parameter-decorators';
import { FileType } from '@common/frontend_shared/enum';
import { BodyUUID, BodyUUIDArray } from '../../validation/body-decorators';
import env from '@common/environment';
import { ApiOkResponse, OutputDto } from '../../decarators';
import { StorageOverviewDto } from '@common/api/types/storage-overview.dto';
import { NoQueryParametersDto } from '@common/api/types/no-query-parameters.dto';
import { IsUploadingDto } from '@common/api/types/files/is-uploading.dto';
import { FilesDto } from '@common/api/types/files/files.dto';
import { FileWithTopicDto } from '@common/api/types/files/file.dto';
import { AddUser, AuthHeader } from '../auth/parameter-decorator';
import { CreatePreSignedURLSDto } from '@common/api/types/create-pre-signed-url.dto';
import {
    FileExistsResponseDto,
    TemporaryFileAccessesDto,
} from '@common/api/types/files/access.dto';

@Controller('file')
export class FileController {
    constructor(private readonly fileService: FileService) {}

    @Get('all')
    @UserOnly()
    @ApiOkResponse({
        description: 'Filtered Files',
        type: FilesDto,
    })
    async allFiles(
        @AddUser() auth: AuthHeader,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
    ): Promise<FilesDto> {
        return await this.fileService.findAll(auth.user.uuid, take, skip);
    }

    @Get('filteredByNames')
    @UserOnly()
    @ApiOkResponse({
        description: 'Filtered Files',
        type: FilesDto,
    })
    async filteredByNames(
        @QueryOptionalString(
            'projectName',
            'Name of a Project (or part there of)',
        )
        projectName: string,
        @QueryOptionalString(
            'missionName',
            'Name of a Mission (or part there of)',
        )
        missionName: string,
        @QueryOptionalString('topics', 'Name of Topics (coma separated)')
        topics: string,
        @QueryOptionalRecord('tags', 'Dictionary Tagtype name to Tag value')
        tags: Record<string, any>,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @AddUser() auth: AuthHeader,
    ): Promise<FilesDto> {
        return await this.fileService.findFilteredByNames(
            projectName,
            missionName,
            topics,
            auth.user.uuid,
            take,
            skip,
            tags,
        );
    }

    @Get('many')
    @LoggedIn()
    @ApiOkResponse({
        description: 'Many Files',
        type: FilesDto,
    })
    async getMany(
        @QueryOptionalUUIDArray('fileUuids', 'List of File UUIDs to fetch')
        fileUuids: string[],
        @QueryOptionalUUIDArray(
            'missionUuids',
            'List of Mission UUIDs to fetch',
        )
        missionUuids: string[],
        @QueryOptionalUUIDArray(
            'projectUuids',
            'List of Project UUIDs to fetch',
        )
        projectUuids: string[],
        @QueryOptionalStringArray(
            'filePatterns',
            'List of filenames or patterns to fetch',
        )
        filePatterns: string[],
        @QueryOptionalStringArray(
            'missionPatterns',
            'List of mission names or patterns to fetch',
        )
        missionPatterns: string[],
        @QueryOptionalStringArray(
            'projectPatterns',
            'List of project names or patterns to fetch',
        )
        projectPatterns: string[],
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @AddUser() auth: AuthHeader,
    ) {
        return await this.fileService.findMany(
            projectUuids,
            projectPatterns,
            missionUuids,
            missionPatterns,
            fileUuids,
            filePatterns,
            take,
            skip,
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

    @Get('byName')
    @CanReadFileByName()
    @OutputDto(null) // TODO: type API response
    async getFileByName(@QueryString('name', 'Filename') name: string) {
        return this.fileService.findByFilename(name);
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
    @ApiOkResponse({
        description: 'Temporary access granted',
        type: TemporaryFileAccessesDto,
    })
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
    // TODO: type API response
    async cancelUpload(
        @BodyUUIDArray(
            'uuids',
            "File UUIDs who, if they aren't 'OK', are deleted",
        )
        uuids: string[],
        @BodyUUID('missionUUID', 'Mission UUID') missionUUID: string,
        @AddUser() auth: AuthHeader,
    ) {
        logger.debug(`cancelUpload ${uuids.toString()}`);
        return this.fileService.cancelUpload(
            uuids,
            missionUUID,
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
