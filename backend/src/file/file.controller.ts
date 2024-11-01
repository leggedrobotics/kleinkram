import {
    Body,
    Controller,
    Delete,
    Get,
    Post,
    Put,
    Query,
} from '@nestjs/common';
import { FileService } from './file.service';
import { UpdateFile } from './entities/update-file.dto';
import logger from '../logger';
import {
    AdminOnly,
    CanCreateInMissionByBody,
    CanDeleteFile,
    CanDeleteMission,
    CanReadFile,
    CanReadFileByName,
    CanReadMission,
    CanWriteFile,
    CanMoveFiles,
    LoggedIn,
    UserOnly,
} from '../auth/roles.decorator';
import { addUser, AuthRes } from '../auth/paramDecorator';
import {
    QueryBoolean,
    QueryOptionalBoolean,
    QueryOptionalDate,
    QueryOptionalRecord,
    QueryOptionalString,
    QueryOptionalStringArray,
    QueryOptionalUUID,
    QuerySkip,
    QuerySortBy,
    QueryString,
    QueryTake,
    QueryUUID,
} from '../validation/queryDecorators';
import { ParamUUID } from '../validation/paramDecorators';
import { FileType } from '@common/enum';
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
        @QueryOptionalString('projectName') projectName: string,
        @QueryOptionalString('missionName') missionName: string,
        @QueryOptionalString('topics') topics: string,
        @QueryOptionalRecord('tags') tags: Record<string, any>,
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
        @QueryOptionalString('fileName') fileName: string,
        @QueryOptionalUUID('projectUUID') projectUUID: string,
        @QueryOptionalUUID('missionUUID') missionUUID: string,
        @QueryOptionalDate('startDate') startDate: Date | undefined,
        @QueryOptionalDate('endDate') endDate: Date | undefined,
        @Query('topics') topics: string,
        @Query('fileTypes') fileTypes: string,
        @Query('andOr') andOr: boolean,
        @QueryOptionalString('tags') tags: string,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @QuerySortBy('sort') sort: string,
        @QueryOptionalBoolean('desc') desc: boolean,
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
            JSON.parse(tags),
            auth.user.uuid,
            take,
            skip,
            sort,
            desc,
        );
    }

    @Get('download')
    @CanReadFile()
    async download(
        @QueryUUID('uuid') uuid: string,
        @QueryBoolean('expires') expires: boolean,
    ) {
        logger.debug('download ' + uuid + ': expires=' + expires);
        return this.fileService.generateDownload(uuid, expires);
    }

    @Get('one')
    @CanReadFile()
    async getFileById(@QueryUUID('uuid') uuid: string) {
        return this.fileService.findOne(uuid);
    }

    @Get('byName')
    @CanReadFileByName()
    async getFileByName(@QueryString('name') name: string) {
        return this.fileService.findByFilename(name);
    }

    @Get('ofMission')
    @CanReadMission()
    async getFilesOfMission(
        @QueryUUID('uuid') uuid: string,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @QueryOptionalString('filename') filename: string,
        @QueryOptionalString('fileType') fileType: FileType,
        @QueryOptionalStringArray('categories') categories: string[],
        @QuerySortBy('sort') sort: string,
        @QueryOptionalBoolean('desc') desc: boolean,
        @QueryOptionalString('health') health: string,
    ) {
        return this.fileService.findByMission(
            uuid,
            take,
            skip,
            filename,
            fileType,
            categories,
            sort,
            desc,
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
        @BodyUUIDArray('fileUUIDs') fileUUIDs: string[],
        @BodyUUID('missionUUID') missionUUID: string,
    ) {
        return this.fileService.moveFiles(fileUUIDs, missionUUID);
    }

    @Get('oneByName')
    @CanReadMission()
    async getOneFileByName(
        @QueryUUID('uuid') uuid: string,
        @QueryString('filename') name: string,
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
        @BodyUUIDArray('uuids') uuids: string[],
        @BodyUUID('missionUUID') missionUUID: string,
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
        @BodyUUIDArray('uuids') uuids: string[],
        @BodyUUID('missionUUID') missionUUID: string,
    ) {
        return this.fileService.deleteMultiple(uuids, missionUUID);
    }

    @Get('exists')
    @CanReadFile()
    async exists(@QueryUUID('uuid') uuid: string) {
        return this.fileService.exists(uuid);
    }

    @Post('resetMinioTags')
    @AdminOnly()
    async resetMinioTags() {
        logger.debug('Resetting Minio tags');
        await this.fileService.renameTags(env.MINIO_BAG_BUCKET_NAME);
        await this.fileService.renameTags(env.MINIO_MCAP_BUCKET_NAME);
    }
}
