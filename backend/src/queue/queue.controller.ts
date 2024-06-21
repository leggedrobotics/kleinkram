import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { QueueService } from './queue.service';
import { DriveCreate } from './entities/drive-create.dto';
import logger from '../logger';
import {
    AdminOnly,
    CanCreateQueueByBody,
    CanWriteMissionByBody,
    LoggedIn,
} from '../auth/roles.decorator';
import { addJWTUser, JWTUser } from '../auth/paramDecorator';

@Controller('queue')
export class QueueController {
    constructor(private readonly queueService: QueueService) {}

    @Post('createdrive')
    @CanWriteMissionByBody()
    async createDrive(@Body() body: DriveCreate, @addJWTUser() user: JWTUser) {
        return this.queueService.createDrive(body, user);
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
    @CanWriteMissionByBody()
    async create(
        @Body() body: { filenames: string[]; missionUUID: string },
        @addJWTUser() user: JWTUser,
    ) {
        logger.debug('createPreSignedURLS', body.filenames, body.missionUUID);
        return this.queueService.handleFileUpload(
            body.filenames,
            body.missionUUID,
            user,
        );
    }

    @Post('confirmUpload')
    @CanCreateQueueByBody()
    async confirmUpload(@Body() body: { uuid: string }) {
        return this.queueService.confirmUpload(body.uuid);
    }

    @Get('active')
    @LoggedIn()
    async active(
        @Query('startDate') startDate: string,
        @addJWTUser() user: JWTUser,
    ) {
        const date = new Date(startDate);
        // Additional validation to handle invalid dates could be placed here
        if (isNaN(date.getTime())) {
            // Check if date is valid
            throw new Error('Invalid date format');
        }
        return this.queueService.active(date, user.uuid);
    }

    @Delete('clear')
    @AdminOnly()
    async clear() {
        return this.queueService.clear();
    }
}
