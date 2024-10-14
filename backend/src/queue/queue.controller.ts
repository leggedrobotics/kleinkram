import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { QueueService } from './queue.service';
import { DriveCreate } from './entities/drive-create.dto';
import {
    AdminOnly,
    CanCreateInMissionByBody,
    CanCreateQueueByBody,
    CanDeleteMission,
    CanReadMission,
    LoggedIn,
} from '../auth/roles.decorator';
import { addUser, AuthRes } from '../auth/paramDecorator';
import { BodyString, BodyUUID } from '../validation/bodyDecorators';
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

    @Post('import_from_drive')
    @CanCreateInMissionByBody()
    async importFromDrive(
        @Body() body: DriveCreate,
        @addUser() authRes: AuthRes,
    ) {
        return this.queueService.importFromDrive(body, authRes.user);
    }

    @Post('confirmUpload')
    @CanCreateQueueByBody()
    async confirmUpload(
        @BodyUUID('uuid') uuid: string,
        @BodyString('md5') md5: string,
    ) {
        return this.queueService.confirmUpload(uuid, md5);
    }

    @Get('active')
    @LoggedIn()
    async active(
        @QueryDate('startDate') startDate: string,
        @QueryOptionalString('stateFilter') stateFilter: string,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @addUser() user: AuthRes,
    ) {
        const date = new Date(startDate);

        return this.queueService.active(
            date,
            stateFilter,
            user.user.uuid,
            skip,
            take,
        );
    }

    @Get('forFile')
    @CanReadMission()
    async forFile(
        @QueryString('filename') filename: string,
        @QueryUUID('uuid') uuid: string, // Mission UUID
    ) {
        return this.queueService.forFile(filename, uuid);
    }

    @Delete(':uuid')
    @CanDeleteMission()
    async delete(
        @BodyUUID('missionUUID') missionUUID: string,
        @ParamUUID('uuid') uuid: string,
    ) {
        return this.queueService.delete(missionUUID, uuid);
    }

    @Post('cancelProcessing')
    @CanDeleteMission()
    async cancelProcessing(
        @BodyUUID('queueUUID') queueUUID: string,
        @BodyUUID('missionUUID') missionUUID: string,
    ) {
        return this.queueService.cancelProcessing(queueUUID, missionUUID);
    }

    @Get('bullQueue')
    @AdminOnly()
    async bullQueue() {
        return this.queueService.bullQueue();
    }

    @Post('stopJob')
    @AdminOnly()
    async stopJob(@BodyUUID('jobId') jobId: string) {
        return this.queueService.stopJob(jobId);
    }
}
