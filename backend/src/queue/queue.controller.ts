import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { QueueService } from './queue.service';
import { DriveCreate } from './entities/drive-create.dto';
import logger from '../logger';
import { AdminOnly, LoggedIn } from '../auth/roles.decorator';
import { addJWTUser, JWTUser } from '../auth/paramDecorator';

@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Post('createdrive')
  @LoggedIn()
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
  @LoggedIn()
  async create(
    @Body() body: { filenames: string[]; runUUID: string },
    @addJWTUser() user: JWTUser,
  ) {
    logger.debug('createPreSignedURLS', body.filenames, body.runUUID);
    return this.queueService.handleFileUpload(
      body.filenames,
      body.runUUID,
      user,
    );
  }

  @Post('confirmUpload')
  @LoggedIn()
  async confirmUpload(@Body() body: { filename: string }) {
    return this.queueService.confirmUpload(body.filename);
  }

  @Get('active')
  @LoggedIn()
  async active(@Query('startDate') startDate: string) {
    const date = new Date(startDate);
    // Additional validation to handle invalid dates could be placed here
    if (isNaN(date.getTime())) {
      // Check if date is valid
      throw new Error('Invalid date format');
    }
    return this.queueService.active(date);
  }

  @Delete('clear')
  @AdminOnly()
  async clear() {
    return this.queueService.clear();
  }
}
