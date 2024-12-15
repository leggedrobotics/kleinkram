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
import { FileQueueEntriesDto } from '@common/api/types/file-queue-entry.dto';
import { AddUser, AuthHeader } from '../auth/param-decorator';
import { StopJobResponseDto } from '@common/api/types/queue/stop-job-response.dto';
import { BullQueueDto } from '@common/api/types/queue/bull-queue.dto';
import { CancleProgessingResponseDto } from '@common/api/types/cancle-progessing-response.dto';
import { DeleteMissionResponseDto } from '@common/api/types/delete-mission-response.dto';
import { QueueActiveDto } from '@common/api/types/queue-active.dto';
import { UpdateTagTypeDto } from '@common/api/types/update-tag-type.dto';
import { ConfirmUploadDto } from '@common/api/types/confirm-upload.dto';

@Controller('queue')
export class QueueController {
    constructor(private readonly queueService: QueueService) {}

    @Post('import_from_drive')
    @CanCreateInMissionByBody()
    @ApiOkResponse({
        type: UpdateTagTypeDto,
    })
    async importFromDrive(
        @Body() body: DriveCreate,
        @AddUser() authHeader: AuthHeader,
    ): Promise<UpdateTagTypeDto> {
        return this.queueService.importFromDrive(body, authHeader.user);
    }

    @Post('confirmUpload')
    @CanCreateQueueByBody()
    @ApiOkResponse({
        type: ConfirmUploadDto,
    })
    async confirmUpload(
        @BodyUUID('uuid', 'File UUID of file that successfully uploaded')
        uuid: string,
        @BodyString('md5', 'MD5 hash to validate uncorrupted upload')
        md5: string,
    ): Promise<ConfirmUploadDto> {
        await this.queueService.confirmUpload(uuid, md5);
        return {
            success: true,
        };
    }

    @Get('active')
    @LoggedIn()
    @ApiOkResponse({
        type: QueueActiveDto,
    })
    async active(
        @QueryDate('startDate', 'Start of time range to filter queue by')
        startDate: string,
        @QueryOptionalString('stateFilter', 'State of QueueEntity to filter by')
        stateFilter: string,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @AddUser() user: AuthHeader,
    ): Promise<QueueActiveDto> {
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
    ): Promise<FileQueueEntriesDto> {
        return this.queueService.forFile(filename, uuid);
    }

    @Delete(':uuid')
    @CanDeleteMission()
    @ApiOkResponse({
        type: DeleteMissionResponseDto,
    })
    async delete(
        @BodyUUID('missionUUID', 'Mission UUID') missionUUID: string,
        @ParameterUID('uuid') uuid: string,
    ): Promise<DeleteMissionResponseDto> {
        return this.queueService.delete(missionUUID, uuid);
    }

    @Post('cancelProcessing')
    @CanDeleteMission()
    @ApiOkResponse({
        type: CancleProgessingResponseDto,
    })
    async cancelProcessing(
        @BodyUUID('queueUUID', 'Queue UUID to cancel') queueUUID: string,
        @BodyUUID('missionUUID', 'Mission UUID of Queue') missionUUID: string,
    ): Promise<CancleProgessingResponseDto> {
        return this.queueService.cancelProcessing(queueUUID, missionUUID);
    }

    @Get('bullQueue')
    @AdminOnly()
    @OutputDto(null) // TODO: type API response
    async bullQueue(): Promise<BullQueueDto> {
        return this.queueService.bullQueue();
    }

    @Post('stopJob')
    @AdminOnly()
    @ApiOkResponse({
        type: StopJobResponseDto,
    })
    async stopJob(
        @BodyUUID('jobId', 'Bull ID of Job to cancel') jobId: string,
    ): Promise<StopJobResponseDto> {
        return this.queueService.stopJob(jobId);
    }
}
