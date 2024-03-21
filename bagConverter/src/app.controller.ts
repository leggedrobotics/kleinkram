import {
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { AppService } from './app.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('convert')
  @UseInterceptors(FileInterceptor('file'))
  convertFile(@UploadedFile() file: Express.Multer.File): Promise<void> {
    return this.appService.convertFile(file);
  }
}
