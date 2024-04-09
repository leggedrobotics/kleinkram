import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  Get,
  Put,
  Param,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileService } from './file.service';
import { UpdateFile } from './entities/update-file.dto';
import { CreateFile } from './entities/create-file.dto';

@Controller('file')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Get('all')
  async allFiles() {
    return await this.fileService.findAll();
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

  @Get(':uuid')
  async getFileById(@Param('uuid') uuid: string) {
    return this.fileService.findOne(uuid);
  }

  @Get('download/:uuid')
  async download(@Param('uuid') uuid: string) {
    return this.fileService.generateDownload(uuid);
  }

  @Put(':uuid')
  async update(@Param('uuid') uuid: string, @Body() dto: UpdateFile) {
    return this.fileService.update(uuid, dto);
  }
}
