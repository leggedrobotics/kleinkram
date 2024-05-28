import {
    Controller,
    Body,
    Get,
    Put,
    Param,
    Query,
    Delete,
} from '@nestjs/common';
import { FileService } from './file.service';
import { UpdateFile } from './entities/update-file.dto';
import logger from '../logger';
import { AdminOnly, LoggedIn, TokenOrUser } from '../auth/roles.decorator';

@Controller('file')
export class FileController {
    constructor(private readonly fileService: FileService) {}

    @Get('all')
    @LoggedIn()
    async allFiles() {
        return await this.fileService.findAll();
    }

    @Get('filteredByNames')
    @LoggedIn()
    async filteredByNames(
        @Query('projectName') projectName: string,
        @Query('runName') runName: string,
        @Query('topics') topics: string[],
    ) {
        return await this.fileService.findFilteredByNames(
            projectName,
            runName,
            topics,
        );
    }

    @Get('filtered')
    @LoggedIn()
    async filteredFiles(
        @Query('fileName') fileName: string,
        @Query('projectUUID') projectUUID: string,
        @Query('runUUID') runUUID: string,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Query('topics') topics: string,
        @Query('andOr') andOr: boolean,
    ) {
        return await this.fileService.findFiltered(
            fileName,
            projectUUID,
            runUUID,
            startDate,
            endDate,
            topics,
            andOr,
        );
    }
    @Get('download')
    @LoggedIn()
    async download(
        @Query('uuid') uuid: string,
        @Query('expires') expires: boolean,
    ) {
        logger.debug('download', uuid, expires);
        return this.fileService.generateDownload(uuid, expires);
    }

    @Get('downloadWithToken')
    @TokenOrUser()
    async downloadWithToken(@Query('uuid') uuid: string) {
        logger.debug('downloadWithToken', uuid);
        return this.fileService.generateDownloadForToken(uuid);
    }

    @Get('one')
    @LoggedIn()
    async getFileById(@Query('uuid') uuid: string) {
        return this.fileService.findOne(uuid);
    }

    @Get('byName')
    @LoggedIn()
    async getFileByName(@Query('name') name: string) {
        return this.fileService.findByFilename(name);
    }

    @Get('ofRun')
    @LoggedIn()
    async getFilesOfRun(@Query('runUUID') runUUID: string) {
        return this.fileService.findByRun(runUUID);
    }

    @Put(':uuid')
    @LoggedIn()
    async update(@Param('uuid') uuid: string, @Body() dto: UpdateFile) {
        return this.fileService.update(uuid, dto);
    }

    @Delete('clear')
    @AdminOnly()
    async clear() {
        return this.fileService.clear();
    }
}
