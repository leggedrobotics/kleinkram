import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { MissionService } from '../../services/mission.service';
import { CreateMission } from '@common/api/types/create-mission.dto';
import {
    CanCreateInProjectByBody,
    CanDeleteMission,
    CanMoveMission,
    CanReadManyMissions,
    CanReadMission,
    CanReadMissionByName,
    CanWriteMissionByBody,
    UserOnly,
} from '../auth/roles.decorator';
import {
    QueryOptionalString,
    QuerySkip,
    QuerySortBy,
    QuerySortDirection,
    QueryString,
    QueryStringArray,
    QueryTake,
    QueryUUID,
    QueryOptionalUUIDArray,
} from '../../validation/query-decorators';
import { ParameterUuid as ParameterUID } from '../../validation/parameter-decorators';
import { BodyUUID } from '../../validation/body-decorators';
import { MISSION_NAME_REGEX } from '../../validation/validation-logic';
import { ApiOkResponse, OutputDto } from '../../decarators';
import {
    FlatMissionDto,
    MinimumMissionsDto,
    MissionsDto,
    MissionWithFilesDto,
} from '@common/api/types/mission.dto';
import { AddUser, AuthHeader } from '../auth/parameter-decorator';
import { QueryOptionalStringArray } from 'dist/backend/src/validation/query-decorators';

@Controller('mission')
export class MissionController {
    constructor(private readonly missionService: MissionService) { }

    @Post('create')
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

    @Post('updateName')
    @CanWriteMissionByBody()
    @OutputDto(null) // TODO: type API response
    async updateMissionName(
        @BodyUUID('missionUUID', 'Mission UUID') missionUUID: string,
        @Body('name') name: string,
    ) {
        // validate name
        if (!MISSION_NAME_REGEX.test(name)) {
            throw new Error('Invalid name');
        }

        return this.missionService.updateName(missionUUID, name);
    }

    @Get('many')
    @UserOnly()
    @ApiOkResponse({
        description: 'Returns all missions',
        type: MissionsDto,
    })
    async getMany(
        @QueryOptionalUUIDArray('missionUuids', 'List of Mission UUIDs') missionUuids: string[],
        @QueryOptionalUUIDArray('projectUuids', 'List of Project UUIDs') projectUuids: string[],
        @QueryOptionalStringArray('missionPatterns', 'List of Mission Names') missionNames: string[],
        @QueryOptionalStringArray('projectPatterns', 'List of Project Names') projectNames: string[],
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @AddUser() user: AuthHeader,
    ): Promise<MissionsDto> {
        return await this.missionService.findManyNew(
            projectUuids, projectNames, missionUuids, missionNames, skip, take, user.user.uuid
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

    @Get('one')
    @CanReadMission()
    @ApiOkResponse({
        description: 'Returns the mission',
        type: MissionWithFilesDto,
    })
    async getMissionById(
        @QueryUUID('uuid', 'Mission UUID') uuid: string,
    ): Promise<MissionWithFilesDto> {
        return this.missionService.findOne(uuid);
    }

    @Get('all')
    @UserOnly()
    @OutputDto(null) // TODO: type API response
    async allMissions(
        @AddUser() user: AuthHeader,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
    ) {
        return this.missionService.findAll(user.user.uuid, skip, take);
    }

    @Get('byName')
    @CanReadMissionByName()
    @OutputDto(null) // TODO: type API response
    async getMissionByName(
        @QueryString('name', 'Mission Name') name: string,
        @QueryUUID('projectUUID', 'Project UUID') projectUuid: string,
    ) {
        return await this.missionService.findOneByName(name, projectUuid);
    }

    @Get('download')
    @CanReadMission()
    @OutputDto(null) // TODO: type API response
    async downloadWithToken(@QueryUUID('uuid', 'Mission UUID') uuid: string) {
        return this.missionService.download(uuid);
    }

    @Get('filteredByProjectName')
    @UserOnly()
    @ApiOkResponse({
        description: 'Returns all missions filtered by project name',
        type: MissionsDto,
    })
    async filteredByProjectName(
        @QueryString('projectName', 'Project Name') projectName: string,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @AddUser() user: AuthHeader,
    ): Promise<MissionsDto> {
        return this.missionService.filteredByProjectName(
            projectName,
            user.user.uuid,
            skip,
            take,
        );
    }

    @Post('move')
    @CanMoveMission()
    @OutputDto(null) // TODO: type API response
    async moveMission(
        @QueryUUID('missionUUID', 'Mission UUID') missionUUID: string,
        @QueryUUID('projectUUID', 'Project UUID') projectUUID: string,
    ): Promise<void> {
        return this.missionService.moveMission(missionUUID, projectUUID);
    }

    @Delete(':uuid')
    @CanDeleteMission()
    @OutputDto(null) // TODO: type API response
    async deleteMission(@ParameterUID('uuid') uuid: string): Promise<void> {
        return this.missionService.deleteMission(uuid);
    }

    @Post('tags')
    @CanWriteMissionByBody()
    @OutputDto(null) // TODO: type API response
    async updateMissionTags(
        @BodyUUID('missionUUID', 'Mission UUID') missionUUID: string,
        @Body('tags') tags: Record<string, string>,
    ): Promise<void> {
        await this.missionService.updateTags(missionUUID, tags);
    }

    @Get('many')
    @CanReadManyMissions()
    @OutputDto(null) // TODO: type API response
    async getManyMissions(
        @QueryStringArray('uuids', 'List of Mission UUIDs') uuids: string[],
    ) {
        return this.missionService.findMany(uuids);
    }
}
