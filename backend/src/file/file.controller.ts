import { Controller, Body, Get, Put, Param, Query } from '@nestjs/common';
import { FileService } from './file.service';
import { UpdateFile } from './entities/update-file.dto';
import logger from '../logger';

@Controller('file')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Get('all')
  async allFiles() {
    return await this.fileService.findAll();
  }

  @Get('filteredByNames')
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
  async download(
    @Query('uuid') uuid: string,
    @Query('expires') expires: boolean,
  ) {
    logger.debug('download', uuid, expires);
    return this.fileService.generateDownload(uuid, expires);
  }

  @Get('one')
  async getFileById(@Query('uuid') uuid: string) {
    return this.fileService.findOne(uuid);
  }

  @Get('byName')
  async getFileByName(@Query('name') name: string) {
    return this.fileService.findByFilename(name);
  }

  @Put(':uuid')
  async update(@Param('uuid') uuid: string, @Body() dto: UpdateFile) {
    return this.fileService.update(uuid, dto);
  }
}
