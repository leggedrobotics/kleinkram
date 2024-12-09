import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { QueueService } from '../../services/queue.service';
import { DriveCreate } from '@common/api/types/drive-create.dto';
import {
    AdminOnly,
    CanCreateInMissionByBody,
    CanCreateQueueByBody,
    CanDeleteMission,
    CanReadMission,
    LoggedIn,
} from '../auth/roles.decorator';
import { BodyString, BodyUUID } from '../../validation/bodyDecorators';
import {
    QueryDate,
    QueryOptionalString,
    QuerySkip,
    QueryString,
    QueryTake,
    QueryUUID,
} from '../../validation/queryDecorators';
import { ParamUUID as ParameterUID } from '../../validation/paramDecorators';
import { ApiOkResponse, OutputDto } from '../../decarators';
import { FileQueueEntriesDto } from '@common/api/types/FileQueueEntry.dto';
import { AddUser, AuthRes } from '../auth/param-decorator';

@Controller('queue')
export class QueueController {
    constructor(private readonly queueService: QueueService) {}

    @Post('import_from_drive')
    @CanCreateInMissionByBody()
    async importFromDrive(
        @Body() body: DriveCreate,
        @AddUser() authRes: AuthRes,
    ) {
        return this.queueService.importFromDrive(body, authRes.user);
    }

    @Post('confirmUpload')
    @CanCreateQueueByBody()
    @OutputDto(null)
    async confirmUpload(
        @BodyUUID('uuid', 'File UUID of file that successfully uploaded')
        uuid: string,
        @BodyString('md5', 'MD5 hash to validate uncorrupted upload')
        md5: string,
    ): Promise<void> {
        return this.queueService.confirmUpload(uuid, md5);
    }

    @Get('active')
    @LoggedIn()
    // TODO: add response type
    async active(
        @QueryDate('startDate', 'Start of time range to filter queue by')
        startDate: string,
        @QueryOptionalString('stateFilter', 'State of QueueEntity to filter by')
        stateFilter: string,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @AddUser() user: AuthRes,
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
    @ApiOkResponse({
        description: 'Get all queues for a specific file',
        type: FileQueueEntriesDto,
    })
    async forFile(
        @QueryString('filename', 'Filename') filename: string,
        @QueryUUID('uuid', 'Mission UUID') uuid: string,
    ) {
        return this.queueService.forFile(filename, uuid);
    }

    @Delete(':uuid')
    @CanDeleteMission()
    @OutputDto(null)
    async delete(
        @BodyUUID('missionUUID', 'Mission UUID') missionUUID: string,
        @ParameterUID('uuid') uuid: string,
    ) {
        return this.queueService.delete(missionUUID, uuid);
    }

    @Post('cancelProcessing')
    @CanDeleteMission()
    @OutputDto(null)
    async cancelProcessing(
        @BodyUUID('queueUUID', 'Queue UUID to cancel') queueUUID: string,
        @BodyUUID('missionUUID', 'Mission UUID of Queue') missionUUID: string,
    ) {
        return this.queueService.cancelProcessing(queueUUID, missionUUID);
    }

    @Get('bullQueue')
    @AdminOnly()
    @OutputDto(null)
    async bullQueue() {
        return this.queueService.bullQueue();
    }

    @Post('stopJob')
    @AdminOnly()
    @OutputDto(null)
    async stopJob(
        @BodyUUID('jobId', 'Bull ID of Job to cancel') jobId: string,
    ) {
        return this.queueService.stopJob(jobId);
    }
}
