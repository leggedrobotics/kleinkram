import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { MissionService } from './mission.service';
import { CreateRun } from './entities/create-mission.dto';
import { AdminOnly, LoggedIn, TokenOrUser } from '../auth/roles.decorator';
import { addJWTUser, JWTUser } from '../auth/paramDecorator';

@Controller('mission')
export class MissionController {
    constructor(private readonly missionService: MissionService) {}

    @Post('create')
    @LoggedIn()
    async createRun(@Body() createRun: CreateRun, @addJWTUser() user: JWTUser) {
        return this.missionService.create(createRun, user);
    }

    @Get('filtered/:projectUUID')
    @LoggedIn()
    async filteredRuns(@Param('projectUUID') projectUUID: string) {
        return this.missionService.findRunByProject(projectUUID);
    }

    @Get('all')
    @LoggedIn()
    async allRuns() {
        return this.missionService.findAll();
    }

    @Get('byName')
    @LoggedIn()
    async getRunByName(@Query('name') name: string) {
        return this.missionService.findOneByName(name);
    }

    @Get('byUUID')
    @TokenOrUser()
    async getRunByUUID(@Query('uuid') uuid: string) {
        return this.missionService.findOneByUUID(uuid);
    }

    @Get('filteredByProjectName/:projectName')
    @LoggedIn()
    async filteredByProjectName(@Param('projectName') projectName: string) {
        return this.missionService.filteredByProjectName(projectName);
    }

    @Delete('clear')
    @AdminOnly()
    async clearRuns() {
        return this.missionService.clearRuns();
    }

    @Post('move')
    @LoggedIn()
    async moveRun(
        @Query('missionUUID') missionUUID: string,
        @Query('projectUUID') projectUUID: string,
    ) {
        return this.missionService.moveRun(missionUUID, projectUUID);
    }
}
