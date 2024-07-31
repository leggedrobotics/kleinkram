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
import { CreatePreSignedURLSDto } from './entities/createPreSignedURLS.dto';
import { BodyUUID } from '../validation/bodyDecorators';
import { QueryDate, QuerySkip, QueryTake } from '../validation/queryDecorators';

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
        @Body() body: CreatePreSignedURLSDto,
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
    async confirmUpload(@BodyUUID('uuid') uuid: string) {
        return this.queueService.confirmUpload(uuid);
    }

    @Get('active')
    @LoggedIn()
    async active(
        @QueryDate('startDate') startDate: string,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @addJWTUser() user: JWTUser,
    ) {
        const date = new Date(startDate);

        return this.queueService.active(date, user.uuid, skip, take);
    }

    @Delete('clear')
    @AdminOnly()
    async clear() {
        return this.queueService.clear();
    }
}
