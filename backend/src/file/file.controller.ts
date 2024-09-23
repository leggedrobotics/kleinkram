import {
    Body,
    Controller,
    Delete,
    Get,
    Post,
    Put,
    Query,
    Req,
    Res,
    Response,
} from '@nestjs/common';
import { FileService } from './file.service';
import { UpdateFile } from './entities/update-file.dto';
import logger from '../logger';
import {
    CanCreateInMissionByBody,
    CanDeleteFile,
    CanDeleteMission,
    CanReadFile,
    CanReadFileByName,
    CanReadMission,
    CanWriteFile,
    CanWriteMissionByBody,
    LoggedIn,
    TokenOrUser,
} from '../auth/roles.decorator';
import { addJWTUser, JWTUser } from '../auth/paramDecorator';
import {
    QueryBoolean,
    QueryOptionalBoolean,
    QueryOptionalDate,
    QueryOptionalRecord,
    QueryOptionalString,
    QueryOptionalUUID,
    QuerySkip,
    QueryString,
    QueryTake,
    QueryUUID,
} from '../validation/queryDecorators';
import { ParamUUID } from '../validation/paramDecorators';
import { FileType } from '@common/enum';
import { BodyUUID, BodyUUIDArray } from '../validation/bodyDecorators';
import { CreatePreSignedURLSDto } from '../queue/entities/createPreSignedURLS.dto';

@Controller('file')
export class FileController {
    constructor(private readonly fileService: FileService) {}

    @Get('all')
    @LoggedIn()
    async allFiles(
        @addJWTUser() user: JWTUser,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
    ) {
        return await this.fileService.findAll(user.uuid, take, skip);
    }

    @Get('filteredByNames')
    @LoggedIn()
    async filteredByNames(
        @QueryOptionalString('projectName') projectName: string,
        @QueryOptionalString('missionName') missionName: string,
        @QueryOptionalString('topics') topics: string,
        @QueryOptionalRecord('tags') tags: Record<string, any>,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @addJWTUser() user: JWTUser,
    ) {
        return await this.fileService.findFilteredByNames(
            projectName,
            missionName,
            topics,
            user.uuid,
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
        @QueryOptionalString('sort') sort: string,
        @QueryOptionalBoolean('desc') desc: boolean,
        @addJWTUser() user: JWTUser,
    ) {
        return await this.fileService.findFiltered(
            fileName,
            projectUUID,
            missionUUID,
            startDate,
            endDate,
            topics,
            andOr,
            fileTypes,
            JSON.parse(tags),
            user.uuid,
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

    @Get('downloadWithToken')
    @TokenOrUser()
    async downloadWithToken(@QueryUUID('uuid') uuid: string) {
        logger.debug('downloadWithTo' + 'ken', uuid);
        return this.fileService.generateDownloadForToken(uuid);
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
    ) {
        return this.fileService.findByMission(
            uuid,
            take,
            skip,
            filename,
            fileType,
        );
    }

    @Put(':uuid')
    @CanWriteFile()
    async update(@ParamUUID('uuid') uuid: string, @Body() dto: UpdateFile) {
        return this.fileService.update(uuid, dto);
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
    async isUploading(@addJWTUser() user: JWTUser) {
        return this.fileService.isUploading(user.uuid);
    }

    @Post('temporaryAccess')
    @CanCreateInMissionByBody()
    async getTemporaryAccess(
        @addJWTUser() user: JWTUser,
        @Body() body: CreatePreSignedURLSDto,
    ) {
        return await this.fileService.getTemporaryAccess(
            body.filenames,
            body.missionUUID,
            user.uuid,
        );
    }

    @Post('cancelUpload')
    @LoggedIn() //Push back authentication to the queue to accelerate the request
    async cancelUpload(
        @BodyUUIDArray('uuids') uuids: string[],
        @BodyUUID('missionUUID') missionUUID: string,
        @addJWTUser() user: JWTUser,
    ) {
        return this.fileService.cancelUpload(uuids, missionUUID, user.uuid);
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
}
