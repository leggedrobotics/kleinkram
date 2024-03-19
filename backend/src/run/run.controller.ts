import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  Get,
  Put,
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RunService } from './run.service';
import { UpdateRun } from './entities/update-run.dto';
import { CreateRun } from './entities/create-run.dto';

@Controller('run')
export class RunController {
  constructor(private readonly runService: RunService) {}

  @Get('all')
  async allRuns() {
    return await this.runService.findAll();
  }

  @Get(':uuid')
  async getRunById(@Param('uuid') uuid: string) {
    return this.runService.findOne(uuid);
  }

  @Post('create')
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: CreateRun, // Use a specific DTO type if available
  ) {
    return this.runService.create(body, file);
  }

  @Put(':uuid')
  async update(@Param('uuid') uuid: string, @Body() dto: UpdateRun) {
    return this.runService.update(uuid, dto);
  }
}
