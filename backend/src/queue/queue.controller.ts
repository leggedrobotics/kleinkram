import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { QueueService } from './queue.service';
import { DriveCreate } from './entities/drive-create.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateFile } from '../file/entities/create-file.dto';

@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Post('createdrive')
  async createDrive(@Body() body: DriveCreate) {
    return this.queueService.createDrive(body);
  }

  @Post('create')
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: CreateFile, // Use a specific DTO type if available
  ) {
    return this.queueService.create(body, file);
  }
}
