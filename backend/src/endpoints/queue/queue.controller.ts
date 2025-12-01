import { CancelProcessingResponseDto } from '@common/api/types/cancel-processing-response.dto';
import { ConfirmUploadDto } from '@common/api/types/confirm-upload.dto';
import { DeleteMissionResponseDto } from '@common/api/types/delete-mission-response.dto';
import { DriveCreate } from '@common/api/types/drive-create.dto';
import { QueueActiveDto } from '@common/api/types/queue-active.dto';
import { UpdateTagTypeDto } from '@common/api/types/update-tag-type.dto';
import { FileSource } from '@common/frontend_shared/enum';
import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { ApiOkResponse, OutputDto } from '../../decarators';
import QueueService from '../../services/queue.service';
import {
    BodyOptionalSource,
    BodyString,
    BodyUUID,
} from '../../validation/body-decorators';
import { ParameterUuid as ParameterUID } from '../../validation/parameter-decorators';
import {
    QueryDate,
    QueryOptionalString,
    QuerySkip,
    QueryTake,
} from '../../validation/query-decorators';
import { AddUser, AuthHeader } from '../auth/parameter-decorator';
import {
    AdminOnly,
    CanCreateInMissionByBody,
    CanDeleteMission,
    LoggedIn,
} from '../auth/roles.decorator';

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
    @LoggedIn()
    @ApiOkResponse({
        type: ConfirmUploadDto,
    })
    async confirmUpload(
        @BodyUUID('uuid', 'File UUID of file that successfully uploaded')
        uuid: string,
        @BodyString('md5', 'MD5 hash to validate uncorrupted upload')
        md5: string,
        @BodyOptionalSource(
            'source',
            'Source of the upload (CLI, Web Interface, etc.)',
        )
        source: FileSource | undefined,
        @AddUser() auth: AuthHeader,
    ): Promise<ConfirmUploadDto> {
        let _source = source;
        if (!_source) {
            _source = FileSource.WEB_INTERFACE;
            if (auth.apiKey) {
                _source = auth.apiKey.action
                    ? FileSource.ACTION
                    : FileSource.CLI;
            }
        }
        await this.queueService.confirmUpload(uuid, md5, auth.user, _source);
        return {
            success: true,
        };
    }

    @Post('recalculateHashes')
    @AdminOnly()
    @OutputDto(null)
    async recalculateHashes(): Promise<{
        success: boolean;
        fileCount: number;
    }> {
        return await this.queueService.recalculateHashes();
    }

    @Get('active')
    @LoggedIn()
    @OutputDto(null)
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
        type: CancelProcessingResponseDto,
    })
    async cancelProcessing(
        @BodyUUID('queueUUID', 'Queue UUID to cancel') queueUUID: string,
        @BodyUUID('missionUUID', 'Mission UUID of Queue') missionUUID: string,
    ): Promise<CancelProcessingResponseDto> {
        return this.queueService.cancelProcessing(queueUUID, missionUUID);
    }

    /**

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
        return this.queueService.stopAction(jobId);
    }

     */
}
