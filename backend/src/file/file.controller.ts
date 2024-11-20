import { Body, Controller, Delete, Get, Post, Put } from '@nestjs/common';
import { FileService } from './file.service';
import { UpdateFile } from './entities/update-file.dto';
import logger from '../logger';
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
import { addUser, AuthRes } from '../auth/paramDecorator';
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
} from '../validation/queryDecorators';
import { ParamUUID } from '../validation/paramDecorators';
import { FileType } from '@common/frontend_shared/enum';
import { BodyUUID, BodyUUIDArray } from '../validation/bodyDecorators';
import { CreatePreSignedURLSDto } from './entities/createPreSignedURLS.dto';
import env from '@common/env';

@Controller('file')
export class FileController {
    constructor(private readonly fileService: FileService) {}

    @Get('all')
    @UserOnly()
    async allFiles(
        @addUser() auth: AuthRes,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
    ) {
        return await this.fileService.findAll(auth.user.uuid, take, skip);
    }

    @Get('filteredByNames')
    @UserOnly()
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
        @addUser() auth: AuthRes,
    ) {
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

    @Get('filtered')
    @LoggedIn()
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
        @addUser() auth: AuthRes,
    ) {
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
            take,
            skip,
            sort,
            sortDirection,
        );
    }

    @Get('download')
    @CanReadFile()
    async download(
        @QueryUUID('uuid', 'File UUID') uuid: string,
        @QueryBoolean(
            'expires',
            'Whether the download link should stay valid for on week (false) or 4h (true)',
        )
        expires: boolean,
    ) {
        logger.debug('download ' + uuid + ': expires=' + expires);
        return this.fileService.generateDownload(uuid, expires);
    }

    @Get('one')
    @CanReadFile()
    async getFileById(@QueryUUID('uuid', 'File UUID') uuid: string) {
        return this.fileService.findOne(uuid);
    }

    @Get('byName')
    @CanReadFileByName()
    async getFileByName(@QueryString('name', 'Filename') name: string) {
        return this.fileService.findByFilename(name);
    }

    @Get('ofMission')
    @CanReadMission()
    async getFilesOfMission(
        @QueryUUID('uuid', 'File UUID') uuid: string,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @QueryOptionalString('filename', 'Filename filter') filename: string,
        @QueryOptionalString('fileType', 'Filetype filter') fileType: FileType,
        @QueryOptionalStringArray(
            'categories',
            'Categories to filter by (logical OR)',
        )
        categories: string[],
        @QuerySortBy('sort') sort: string,
        @QuerySortDirection('sortDirection') sortDirection: 'ASC' | 'DESC',
        @QueryOptionalString('health', 'File health') health: string,
    ) {
        return this.fileService.findByMission(
            uuid,
            take,
            skip,
            filename,
            fileType,
            categories,
            sort,
            sortDirection,
            health,
        );
    }

    @Put(':uuid')
    @CanWriteFile()
    async update(@ParamUUID('uuid') uuid: string, @Body() dto: UpdateFile) {
        return this.fileService.update(uuid, dto);
    }

    @Post('moveFiles')
    @CanMoveFiles()
    async moveFiles(
        @BodyUUIDArray('fileUUIDs', 'List of File UUID to be moved')
        fileUUIDs: string[],
        @BodyUUID('missionUUID', 'UUID of target Mission') missionUUID: string,
    ) {
        return this.fileService.moveFiles(fileUUIDs, missionUUID);
    }

    @Get('oneByName')
    @CanReadMission()
    async getOneFileByName(
        @QueryUUID('uuid', 'Mission UUID to search in') uuid: string,
        @QueryString('filename', 'Filename searched for') name: string,
    ) {
        return this.fileService.findOneByName(uuid, name);
    }

    @Delete(':uuid')
    @CanDeleteFile()
    async deleteFile(@ParamUUID('uuid') uuid: string) {
        return this.fileService.deleteFile(uuid);
    }

    @Get('storage')
    @LoggedIn()
    async getStorage() {
        return this.fileService.getStorage();
    }

    @Get('isUploading')
    @LoggedIn()
    async isUploading(@addUser() auth: AuthRes) {
        return this.fileService.isUploading(auth.user.uuid);
    }

    @Post('temporaryAccess')
    @CanCreateInMissionByBody()
    async getTemporaryAccess(
        @addUser() auth: AuthRes,
        @Body() body: CreatePreSignedURLSDto,
    ) {
        return await this.fileService.getTemporaryAccess(
            body.filenames,
            body.missionUUID,
            auth.user.uuid,
        );
    }

    @Post('cancelUpload')
    @UserOnly() //Push back authentication to the queue to accelerate the request
    async cancelUpload(
        @BodyUUIDArray(
            'uuids',
            "File UUIDs who, if they aren't 'OK', are deleted",
        )
        uuids: string[],
        @BodyUUID('missionUUID', 'Mission UUID') missionUUID: string,
        @addUser() auth: AuthRes,
    ) {
        logger.debug('cancelUpload ' + uuids);
        return this.fileService.cancelUpload(
            uuids,
            missionUUID,
            auth.user.uuid,
        );
    }

    @Post('deleteMultiple')
    @CanDeleteMission()
    async deleteMultiple(
        @BodyUUIDArray('uuids', 'List of File UUID to be deleted')
        uuids: string[],
        @BodyUUID('missionUUID', 'Mission UUID') missionUUID: string,
    ) {
        return this.fileService.deleteMultiple(uuids, missionUUID);
    }

    @Get('exists')
    @CanReadFile()
    async exists(@QueryUUID('uuid', 'FileUUID searched') uuid: string) {
        return this.fileService.exists(uuid);
    }

    @Post('resetMinioTags')
    @AdminOnly()
    async resetMinioTags() {
        logger.debug('Resetting Minio tags');
        await this.fileService.renameTags(env.MINIO_BAG_BUCKET_NAME);
        await this.fileService.renameTags(env.MINIO_MCAP_BUCKET_NAME);
    }

    @Post('recomputeFileSizes')
    @AdminOnly()
    async recomputeFileSizes() {
        logger.debug('Recomputing file sizes');
        await this.fileService.recomputeFileSizes();
    }
}
