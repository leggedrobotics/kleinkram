import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { MissionService } from './mission.service';
import { CreateMission } from './entities/create-mission.dto';
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
import { AddUser, AuthRes } from '../auth/paramDecorator';
import {
    QueryOptionalString,
    QuerySkip,
    QuerySortBy,
    QuerySortDirection,
    QueryString,
    QueryStringArray,
    QueryTake,
    QueryUUID,
} from '../validation/queryDecorators';
import { ParamUUID as ParameterUID } from '../validation/paramDecorators';
import { BodyUUID } from '../validation/bodyDecorators';
import { MISSION_NAME_REGEX } from '../validation/validationLogic';
import { ApiOkResponse } from '../decarators';
import {
    FlatMissionDto,
    MissionsDto,
    MissionWithFilesDto,
} from '@common/api/types/Mission.dto';
import { ApiOperation } from '@nestjs/swagger';

@Controller('mission')
export class MissionController {
    constructor(private readonly missionService: MissionService) {}

    @Post('create')
    @CanCreateInProjectByBody()
    @ApiOkResponse({
        description: 'Returns the created mission',
        type: FlatMissionDto,
    })
    async createMission(
        @Body() createMission: CreateMission,
        @AddUser() user: AuthRes,
    ): Promise<FlatMissionDto> {
        return this.missionService.create(createMission, user);
    }

    @Post('updateName')
    @CanWriteMissionByBody()
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

    @Get('filteredMinimal')
    @UserOnly()
    @ApiOperation({
        deprecated: true,
    })
    async filteredMissionsMinimal(
        @QueryUUID('uuid', 'Project UUID') uuid: string,
        @QueryOptionalString('search', 'Search in mission name') search: string,
        @QuerySortDirection('sortDirection') sortDirection: 'ASC' | 'DESC',
        @QuerySortBy('sortBy') sortBy: string,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @AddUser() user: AuthRes,
    ) {
        return this.missionService.findMissionByProjectMinimal(
            user.user.uuid,
            uuid,
            skip,
            take,
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
        @AddUser() user: AuthRes,
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
    async allMissions(
        @AddUser() user: AuthRes,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
    ) {
        return this.missionService.findAll(user.user.uuid, skip, take);
    }

    @Get('byName')
    @CanReadMissionByName()
    async getMissionByName(
        @QueryString('name', 'Mission Name') name: string,
        @QueryUUID('projectUUID', 'Project UUID') projectUuid: string,
    ) {
        return await this.missionService.findOneByName(name, projectUuid);
    }

    @Get('download')
    @CanReadMission()
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
        @AddUser() user: AuthRes,
    ) {
        return this.missionService.filteredByProjectName(
            projectName,
            user.user.uuid,
            skip,
            take,
        );
    }

    @Post('move')
    @CanMoveMission()
    async moveMission(
        @QueryUUID('missionUUID', 'Mission UUID') missionUUID: string,
        @QueryUUID('projectUUID', 'Project UUID') projectUUID: string,
    ) {
        return this.missionService.moveMission(missionUUID, projectUUID);
    }

    @Delete(':uuid')
    @CanDeleteMission()
    async deleteMission(@ParameterUID('uuid') uuid: string) {
        return this.missionService.deleteMission(uuid);
    }

    @Post('tags')
    @CanWriteMissionByBody()
    async updateMissionTags(
        @BodyUUID('missionUUID', 'Mission UUID') missionUUID: string,
        @Body('tags') tags: Record<string, string>,
    ) {
        return this.missionService.updateTags(missionUUID, tags);
    }

    @Get('many')
    @CanReadManyMissions()
    async getManyMissions(
        @QueryStringArray('uuids', 'List of Mission UUIDs') uuids: string[],
    ) {
        return this.missionService.findMany(uuids);
    }
}
