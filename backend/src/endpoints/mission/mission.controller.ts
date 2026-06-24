import { ApiCreatedResponse, ApiOkResponse } from '@/decorators';
import { missionEntityToFlatDto } from '@/serialization';
import { MetadataService } from '@/services/metadata.service';
import { MissionService } from '@/services/mission.service';
import { QueryUUID } from '@/validation/query-decorators';
import {
    AddTagsDto,
    AddTagsRequestDto,
    CreateMission,
    FilteredMissionsQueryDto,
    FlatMissionDto,
    MinimumMissionsDto,
    MissionDownloadEntryDto,
    MissionQueryDto,
    MissionsDto,
    MissionWithFilesDto,
    SuccessResponseDto,
    UpdateMissionNameDto,
} from '@kleinkram/api-dto';
import {
    Body,
    Controller,
    Delete,
    Get,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { ParameterUuid as ParameterUID } from '../../validation/parameter-decorators';
import {
    CanAddTag,
    CanCreateInProjectByBody,
    CanDeleteMission,
    CanMoveMission,
    CanReadMission,
    CanWriteMissionByBody,
    UserOnly,
} from '../auth/roles.decorator';

import { AddUser, AuthHeader } from '../auth/parameter-decorator';

@Controller('missions')
export class MissionController {
    constructor(
        private readonly missionService: MissionService,
        private readonly metadataService: MetadataService,
    ) {}

    @Post()
    @CanCreateInProjectByBody()
    @ApiCreatedResponse({
        description: 'Returns the created mission',
        type: FlatMissionDto,
    })
    async createMission(
        @Body() createMission: CreateMission,
        @AddUser() user: AuthHeader,
    ): Promise<FlatMissionDto> {
        return this.missionService.create(createMission, user);
    }

    @Patch(':uuid/name')
    @CanWriteMissionByBody()
    @ApiOkResponse({
        description: 'Returns the updated mission',
        type: FlatMissionDto,
    })
    async updateMissionName(
        @ParameterUID('uuid') missionUUID: string,
        @Body() body: UpdateMissionNameDto,
    ): Promise<FlatMissionDto> {
        const updatedMission = await this.missionService.updateName(
            missionUUID,
            body.name,
        );
        return missionEntityToFlatDto(updatedMission);
    }

    @Get()
    @UserOnly()
    @ApiOkResponse({
        description: 'Returns all missions',
        type: MissionsDto,
    })
    async getMany(
        @Query() query: MissionQueryDto,
        @AddUser() user: AuthHeader,
    ): Promise<MissionsDto> {
        return await this.missionService.findMany(
            query.projectUuids ?? [],
            query.projectPatterns ?? [],
            query.missionUuids ?? [],
            query.missionPatterns ?? [],
            query.metadata ?? {},
            query.sortBy,
            query.sortOrder,
            query.skip,
            query.take,
            user.user.uuid,
        );
    }

    @Get('filteredMinimal')
    @UserOnly()
    @ApiOkResponse({
        description: 'Returns all missions filtered by project',
        type: MinimumMissionsDto,
    })
    async filteredMissionsMinimal(
        @Query() query: FilteredMissionsQueryDto,
        @AddUser() user: AuthHeader,
    ): Promise<MinimumMissionsDto> {
        return this.missionService.findMissionByProjectMinimal(
            user.user.uuid,
            query.uuid,
            query.skip,
            query.take,
            query.search,
            query.sortDirection,
            query.sortBy,
        );
    }

    @Get('filtered')
    @UserOnly()
    @ApiOkResponse({
        description: 'Returns all missions filtered by project',
        type: MissionsDto,
    })
    async filteredMissions(
        @Query() query: FilteredMissionsQueryDto,
        @AddUser() user: AuthHeader,
    ): Promise<MissionsDto> {
        return this.missionService.findMissionByProject(
            user.user,
            query.uuid,
            query.skip,
            query.take,
            query.search,
            query.sortDirection,
            query.sortBy,
        );
    }

    @Get(':uuid')
    @CanReadMission()
    @ApiOkResponse({
        description: 'Returns the mission',
        type: MissionWithFilesDto,
    })
    async getMissionById(
        @ParameterUID('uuid') uuid: string,
    ): Promise<MissionWithFilesDto> {
        return this.missionService.findOne(uuid);
    }

    @Get(':uuid/download')
    @CanReadMission()
    @ApiOkResponse({
        description: 'Download links for the mission files',
        type: [MissionDownloadEntryDto],
    })
    async downloadWithToken(
        @ParameterUID('uuid') uuid: string,
    ): Promise<MissionDownloadEntryDto[]> {
        return this.missionService.download(uuid);
    }

    @Post(':uuid/move')
    @CanMoveMission()
    @ApiCreatedResponse({
        description: 'Mission moved successfully',
        type: SuccessResponseDto,
    })
    async moveMission(
        @ParameterUID('uuid') missionUUID: string,
        @QueryUUID('projectUUID', 'Project UUID') projectUUID: string,
    ): Promise<SuccessResponseDto> {
        await this.missionService.moveMission(missionUUID, projectUUID);
        return { success: true };
    }

    @Delete(':uuid')
    @CanDeleteMission()
    @ApiOkResponse({
        description: 'Mission deleted',
        type: SuccessResponseDto,
    })
    async deleteMission(
        @ParameterUID('uuid') uuid: string,
    ): Promise<SuccessResponseDto> {
        await this.missionService.deleteMission(uuid);
        return { success: true };
    }

    @Post(':uuid/metadata')
    @CanAddTag()
    @ApiCreatedResponse({
        description: 'Metadata added to mission',
        type: AddTagsDto,
    })
    async addTags(
        @ParameterUID('uuid') uuid: string,
        @Body() body: AddTagsRequestDto,
    ): Promise<AddTagsDto> {
        const metadata = body.metadata ?? body.tags ?? {};
        return this.metadataService.addTags(uuid, metadata);
    }
}
