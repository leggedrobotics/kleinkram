import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { QueueService } from './queue.service';
import { DriveCreate } from './entities/drive-create.dto';
import logger from '../logger';
import {
    AdminOnly,
    CanCreateQueueByBody,
    CanReadFile,
    CanReadFileByName,
    CanReadMission,
    CanWriteMissionByBody,
    LoggedIn,
} from '../auth/roles.decorator';
import { addJWTUser, JWTUser } from '../auth/paramDecorator';
import { CreatePreSignedURLSDto } from './entities/createPreSignedURLS.dto';
import { BodyUUID } from '../validation/bodyDecorators';
import {
    QueryDate,
    QueryOptionalString,
    QuerySkip,
    QueryString,
    QueryTake,
    QueryUUID,
} from '../validation/queryDecorators';
import { ParamUUID } from '../validation/paramDecorators';

@Controller('queue')
export class QueueController {
    constructor(private readonly queueService: QueueService) {}

    @Post('createdrive')
    @CanWriteMissionByBody()
    async createDrive(@Body() body: DriveCreate, @addJWTUser() user: JWTUser) {
        return this.queueService.createDrive(body, user);
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
        @QueryOptionalString('stateFilter') stateFilter: string,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @addJWTUser() user: JWTUser,
    ) {
        const date = new Date(startDate);

        return this.queueService.active(
            date,
            stateFilter,
            user.uuid,
            skip,
            take,
        );
    }

    @Get('forFile')
    @CanReadMission()
    async forFile(
        @QueryString('filename') filename: string,
        @QueryUUID('uuid') uuid: string, //Mission UUID
    ) {
        return this.queueService.forFile(filename, uuid);
    }

    @Delete(':uuid')
    @CanWriteMissionByBody()
    async delete(
        @BodyUUID('missionUUID') missionUUID: string,
        @ParamUUID('queueUUID') queueUUID: string,
    ) {
        return this.queueService.delete(missionUUID, queueUUID);
    }

    @Post('cancelProcessing')
    @CanWriteMissionByBody()
    async cancelProcessing(
        @BodyUUID('queueUUID') queueUUID: string,
        @BodyUUID('missionUUID') missionUUID: string,
    ) {
        return this.queueService.cancelProcessing(queueUUID, missionUUID);
    }
}
