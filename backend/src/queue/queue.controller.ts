import { Body, Controller, Post } from '@nestjs/common';
import { QueueService } from './queue.service';
import { DriveCreate } from './entities/drive-create.dto';

@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Post('createdrive')
  async createDrive(@Body() body: DriveCreate) {
    return this.queueService.createDrive(body);
  }

  // @Post('create')
  // @UseInterceptors(FileInterceptor('file'))
  // async create(
  //   @UploadedFile() file: Express.Multer.File,
  //   @Body() body: CreateFile, // Use a specific DTO type if available
  // ) {
  //   return this.queueService.create(body, file);
  // }

  @Post('createPreSignedURLS')
  async create(@Body() body: { filenames: string[]; runUUID: string }) {
    return this.queueService.handleFileUpload(body.filenames, body.runUUID);
  }

  @Post('confirmUpload')
  async confirmUpload(@Body() body: { filename: string }) {
    return this.queueService.confirmUpload(body.filename);
  }
}
