import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Query,
} from '@nestjs/common';
import { MissionService } from './mission.service';
import { CreateMission } from './entities/create-mission.dto';
import {
    AdminOnly,
    CanCreateInMissionByBody,
    CanCreateInProjectByBody,
    CanDeleteMission,
    CanMoveMission,
    CanReadManyMissions,
    CanReadMission,
    CanReadMissionByName,
    CanReadProject,
    CanWriteMissionByBody,
    LoggedIn,
    TokenOrUser,
} from '../auth/roles.decorator';
import { addUser, JWTUser } from '../auth/paramDecorator';
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

@Controller('mission')
export class MissionController {
    constructor(private readonly missionService: MissionService) {}

    @Post('create')
    @CanCreateInProjectByBody()
    async createMission(
        @Body() createMission: CreateMission,
        @addUser() user: JWTUser,
    ) {
        return this.missionService.create(createMission, user);
    }

    @Get('filtered')
    @LoggedIn()
    async filteredMissions(
        @QueryUUID('uuid') uuid: string,
        @QueryOptionalString('search') search: string,
        @QueryOptionalBoolean('descending') descending: boolean,
        @QueryOptionalString('sortBy') sortBy: string,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @addUser() user: JWTUser,
    ) {
        return this.missionService.findMissionByProject(
            uuid,
            skip,
            take,
            search,
            descending,
            sortBy,
            user.uuid,
        );
    }

    @Get('one')
    @CanReadMission()
    async getMissionById(@QueryUUID('uuid') uuid: string) {
        return this.missionService.findOne(uuid);
    }

    @Get('all')
    @LoggedIn()
    async allMissions(
        @addUser() user: JWTUser,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
    ) {
        return this.missionService.findAll(user.uuid, skip, take);
    }

    @Get('byName')
    @CanReadMissionByName()
    async getMissionByName(@QueryString('name') name: string) {
        return this.missionService.findOneByName(name);
    }

    @Get('byUUID')
    @TokenOrUser()
    async getMissionByUUID(
        @QueryUUID('uuid') uuid: string,
        @addUser() user: JWTUser,
    ) {
        return this.missionService.findOneByUUID(uuid);
    }

    @Get('filteredByProjectName')
    @LoggedIn()
    async filteredByProjectName(
        @QueryString('projectName') projectName: string,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @addUser() user: JWTUser,
    ) {
        return this.missionService.filteredByProjectName(
            projectName,
            user.uuid,
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
