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
    LoggedIn,
    UserOnly,
} from '../auth/roles.decorator';
import { addUser, AuthRes } from '../auth/paramDecorator';
import {
    QueryOptionalBoolean,
    QueryOptionalString,
    QuerySkip,
    QueryString,
    QueryStringArray,
    QueryTake,
    QueryUUID,
} from '../validation/queryDecorators';
import { ParamString, ParamUUID } from '../validation/paramDecorators';
import { BodyUUID, BodyUUIDArray } from '../validation/bodyDecorators';
import { UserGuard } from '../auth/roles.guard';

@Controller('mission')
export class MissionController {
    constructor(private readonly missionService: MissionService) {}

    @Post('create')
    @CanCreateInProjectByBody()
    async createMission(
        @Body() createMission: CreateMission,
        @addUser() user: AuthRes,
    ) {
        return this.missionService.create(createMission, user);
    }

    @Get('filtered')
    @UserOnly()
    async filteredMissions(
        @QueryUUID('uuid') uuid: string,
        @QueryOptionalString('search') search: string,
        @QueryOptionalBoolean('descending') descending: boolean,
        @QueryOptionalString('sortBy') sortBy: string,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @addUser() user: AuthRes,
    ) {
        return this.missionService.findMissionByProject(
            uuid,
            skip,
            take,
            search,
            descending,
            sortBy,
            user.user.uuid,
        );
    }

    @Get('one')
    @CanReadMission()
    async getMissionById(@QueryUUID('uuid') uuid: string) {
        return this.missionService.findOne(uuid);
    }

    @Get('all')
    @UserOnly()
    async allMissions(
        @addUser() user: AuthRes,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
    ) {
        return this.missionService.findAll(user.user.uuid, skip, take);
    }

    @Get('byName')
    @CanReadMissionByName()
    async getMissionByName(@QueryString('name') name: string) {
        return this.missionService.findOneByName(name);
    }

    @Get('download')
    @CanReadMission()
    async downloadWithToken(@QueryUUID('uuid') uuid: string) {
        return this.missionService.download(uuid);
    }

    @Get('filteredByProjectName')
    @UserOnly()
    async filteredByProjectName(
        @QueryString('projectName') projectName: string,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @addUser() user: AuthRes,
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
        @QueryUUID('missionUUID') missionUUID: string,
        @QueryUUID('projectUUID') projectUUID: string,
    ) {
        return this.missionService.moveMission(missionUUID, projectUUID);
    }

    @Delete(':uuid')
    @CanDeleteMission()
    async deleteMission(@ParamUUID('uuid') uuid: string) {
        return this.missionService.deleteMission(uuid);
    }

    @Post('tags')
    @CanWriteMissionByBody()
    async updateMissionTags(
        @BodyUUID('missionUUID') missionUUID: string,
        @Body('tags') tags: Record<string, string>,
    ) {
        return this.missionService.updateTags(missionUUID, tags);
    }

    @Get('many')
    @CanReadManyMissions()
    async getManyMissions(@QueryStringArray('uuids') uuids: string[]) {
        return this.missionService.findMany(uuids);
    }
}
