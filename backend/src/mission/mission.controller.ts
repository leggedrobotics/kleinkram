import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
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

@Controller('mission')
export class MissionController {
    constructor(private readonly missionService: MissionService) {
    }

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
    async filteredMissions(@Query('uuid') uuid: string) {
        return this.missionService.findMissionByProject(uuid);
    }

    @Get('one')
    @CanReadMission()
    async getMissionById(@Query('uuid') uuid: string) {
        return this.missionService.findOne(uuid);
    }

    @Get('all')
    @LoggedIn()
    async allMissions(@addJWTUser() user: JWTUser) {
        return this.missionService.findAll(user.uuid);
    }

    @Get('byName')
    @CanReadMissionByName()
    async getMissionByName(@Query('name') name: string) {
        return this.missionService.findOneByName(name);
    }

    @Get('byUUID')
    @TokenOrUser()
    async getMissionByUUID(@Query('uuid') uuid: string) {
        return this.missionService.findOneByUUID(uuid);
    }

    @Get('filteredByProjectName/:projectName')
    @LoggedIn()
    async filteredByProjectName(
        @Param('projectName') projectName: string,
        @addJWTUser() user: JWTUser,
    ) {
        return this.missionService.filteredByProjectName(
            projectName,
            user.uuid,
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
        @Query('missionUUID') missionUUID: string,
        @Query('projectUUID') projectUUID: string,
    ) {
        return this.missionService.moveMission(missionUUID, projectUUID);
    }
}
