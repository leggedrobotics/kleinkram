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
    CanMoveMission,
    CanReadMission,
    CanReadMissionByName,
    CanReadProject,
    LoggedIn,
    TokenOrUser,
} from '../auth/roles.decorator';
import { addJWTUser, JWTUser } from '../auth/paramDecorator';
import {
    QuerySkip,
    QueryString,
    QueryTake,
    QueryUUID,
} from '../validation/queryDecorators';
import { ParamString } from '../validation/paramDecorators';

@Controller('mission')
export class MissionController {
    constructor(private readonly missionService: MissionService) {}

    @Post('create')
    @LoggedIn()
    async createMission(
        @Body() createMission: CreateMission,
        @addJWTUser() user: JWTUser,
    ) {
        return this.missionService.create(createMission, user);
    }

    @Get('filtered')
    @CanReadProject()
    async filteredMissions(
        @QueryUUID('uuid') uuid: string,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
    ) {
        return this.missionService.findMissionByProject(uuid, skip, take);
    }

    @Get('one')
    @CanReadMission()
    async getMissionById(@QueryUUID('uuid') uuid: string) {
        return this.missionService.findOne(uuid);
    }

    @Get('all')
    @LoggedIn()
    async allMissions(
        @addJWTUser() user: JWTUser,
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
        @addJWTUser() user: JWTUser,
    ) {
        return this.missionService.findOneByUUID(uuid);
    }

    @Get('filteredByProjectName/:projectName')
    @LoggedIn()
    async filteredByProjectName(
        @ParamString('projectName') projectName: string,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @addJWTUser() user: JWTUser,
    ) {
        return this.missionService.filteredByProjectName(
            projectName,
            user.uuid,
            skip,
            take,
        );
    }

    @Delete('clear')
    @AdminOnly()
    async clearMissions() {
        return this.missionService.clearMissions();
    }

    @Post('move')
    @CanMoveMission()
    async moveMission(
        @QueryUUID('missionUUID') missionUUID: string,
        @QueryUUID('projectUUID') projectUUID: string,
    ) {
        return this.missionService.moveMission(missionUUID, projectUUID);
    }
}
