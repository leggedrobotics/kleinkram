import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Put,
    Query,
} from '@nestjs/common';
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
    QueryDate,
    QueryOptionalDate,
    QueryString,
    QueryStringArray,
    QueryUUID,
} from '../validation/queryDecorators';
import { ParamUUID } from '../validation/paramDecorators';

@Controller('file')
export class FileController {
    constructor(private readonly fileService: FileService) {}

    @Get('all')
    @LoggedIn()
    async allFiles(@addJWTUser() user: JWTUser) {
        return await this.fileService.findAll(user.uuid);
    }

    @Get('filteredByNames')
    @LoggedIn()
    async filteredByNames(
        @QueryString('projectName') projectName: string,
        @QueryString('missionName') missionName: string,
        @QueryStringArray('topics') topics: string[],
        @addJWTUser() user: JWTUser,
    ) {
        return await this.fileService.findFilteredByNames(
            projectName,
            missionName,
            topics,
            user.uuid,
        );
    }

    @Get('filtered')
    @LoggedIn()
    async filteredFiles(
        @Query('fileName') fileName: string,
        @Query('projectUUID') projectUUID: string,
        @Query('missionUUID') missionUUID: string,
        @QueryOptionalDate('startDate') startDate: Date | undefined,
        @QueryOptionalDate('endDate') endDate: Date | undefined,
        @Query('topics') topics: string,
        @Query('andOr') andOr: boolean,
        @Query('mcapBag') mcapBag: boolean,
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
        );
    }

    @Get('download')
    @CanReadFile()
    async download(
        @QueryUUID('uuid') uuid: string,
        @QueryBoolean('expires') expires: boolean,
    ) {
        logger.debug('download', uuid, expires);
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
    async getFilesOfMission(@QueryUUID('uuid') uuid: string) {
        return this.fileService.findByMission(uuid);
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
}
