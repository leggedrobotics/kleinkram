import { ApiOkResponse } from '@/decorators';
import { missionEntityToFlatDto } from '@/serialization';
import { MissionService } from '@/services/mission.service';
import { TagService } from '@/services/tag.service';
import {
    QueryOptionalString,
    QuerySkip,
    QuerySortBy,
    QuerySortDirection,
    QueryTake,
    QueryUUID,
} from '@/validation/query-decorators';
import {
    AddTagsDto,
    CreateMission,
    FlatMissionDto,
    MinimumMissionsDto,
    MissionDownloadEntryDto,
    MissionQueryDto,
    MissionsDto,
    MissionWithFilesDto,
    SuccessResponseDto,
} from '@kleinkram/api-dto';
import { MISSION_NAME_REGEX } from '@kleinkram/validation';
import {
    BadRequestException,
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
        private readonly tagService: TagService,
    ) {}

    @Post()
    @CanCreateInProjectByBody()
    @ApiOkResponse({
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
        @Body('name') name: string,
    ): Promise<FlatMissionDto> {
        // validate name
        if (!MISSION_NAME_REGEX.test(name)) {
            throw new BadRequestException('Invalid name');
        }

        const updatedMission = await this.missionService.updateName(
            missionUUID,
            name,
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
        @QueryUUID('uuid', 'Project UUID') uuid: string,
        @QueryOptionalString('search', 'Search in mission name') search: string,
        @QuerySortDirection('sortDirection') sortDirection: 'ASC' | 'DESC',
        @QuerySortBy('sortBy') sortBy: string,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @AddUser() user: AuthHeader,
    ): Promise<MinimumMissionsDto> {
        return this.missionService.findMissionByProjectMinimal(
            user.user.uuid,
            uuid,
            // TODO: fix the following
            Number.parseInt(String(skip)),
            Number.parseInt(String(take)),
            search,
            sortDirection,
            sortBy,
        );
    }

    @Get('filtered')
    @UserOnly()
    @ApiOkResponse({
        description: 'Returns all missions filtered by project',
        type: MissionsDto,
    })
    async filteredMissions(
        @QueryUUID('uuid', 'Project UUID') uuid: string,
        @QueryOptionalString('search', 'Search in mission name') search: string,
        @QuerySortDirection('sortDirection') sortDirection: 'ASC' | 'DESC',
        @QuerySortBy('sortBy') sortBy: string,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @AddUser() user: AuthHeader,
    ): Promise<MissionsDto> {
        return this.missionService.findMissionByProject(
            user.user,
            uuid,
            // TODO: cleanup by using a dto for the query params
            //  this automatically validates the query params
            //  and converts them to the correct types
            Number.parseInt(String(skip)),
            Number.parseInt(String(take)),
            search,
            sortDirection,
            sortBy,
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
    @ApiOkResponse({
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
    @ApiOkResponse({
        description: 'Metadata added to mission',
        type: AddTagsDto,
    })
    async addTags(
        @ParameterUID('uuid') uuid: string,
        @Body()
        body: {
            metadata?: Record<string, string>;
            tags?: Record<string, string>;
        },
    ): Promise<AddTagsDto> {
        const metadata = body.metadata ?? body.tags;
        if (!metadata) {
            throw new BadRequestException(
                'metadata or tags object is required',
            );
        }
        return this.tagService.addTags(uuid, metadata);
    }
}
