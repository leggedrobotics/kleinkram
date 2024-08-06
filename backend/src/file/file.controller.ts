import { Body, Controller, Delete, Get, Put, Query } from '@nestjs/common';
import { FileService } from './file.service';
import { UpdateFile } from './entities/update-file.dto';
import logger from '../logger';
import {
    AdminOnly,
    CanReadFile,
    CanReadFileByName,
    CanReadMission,
    CanWriteFile,
    LoggedIn,
    TokenOrUser,
} from '../auth/roles.decorator';
import { addJWTUser, JWTUser } from '../auth/paramDecorator';
import {
    QueryBoolean,
    QueryOptionalDate,
    QuerySkip,
    QueryOptionalString,
    QueryOptionalUUID,
    QueryString,
    QueryTake,
    QueryUUID,
    QueryOptional,
    QueryOptionalRecord,
} from '../validation/queryDecorators';
import { ParamUUID } from '../validation/paramDecorators';
import { FileType } from '@common/enum';

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
        @Query('andOr') andOr: boolean,
        @Query('mcapBag') mcapBag: boolean,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
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
            mcapBag,
            user.uuid,
            take,
            skip,
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
        logger.debug('downloadWithToken', uuid);
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

    @Delete('clear')
    @AdminOnly()
    async clear() {
        return this.fileService.clear();
    }

    @Get('oneByName')
    @CanReadMission()
    async getOneFileByName(
        @QueryUUID('uuid') uuid: string,
        @QueryString('filename') name: string,
    ) {
        return this.fileService.findOneByName(uuid, name);
    }
}
