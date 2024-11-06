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
import { addUser, AuthRes } from '../auth/paramDecorator';
import {
    QueryOptionalBoolean,
    QueryOptionalString,
    QuerySkip, QuerySortBy, QuerySortDirection,
    QueryString,
    QueryStringArray,
    QueryTake,
    QueryUUID,
} from '../validation/queryDecorators';
import { ParamUUID } from '../validation/paramDecorators';
import { BodyUUID } from '../validation/bodyDecorators';

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

    @Post('updateName')
    @CanWriteMissionByBody()
    async updateMissionName(
        @BodyUUID('missionUUID') missionUUID: string,
        @Body('name') name: string,
    ) {
        // validate name
        if (/^[\w\-_]{3,20}$/i.test(name) === false) {
            throw new Error('Invalid name');
        }

        return this.missionService.updateName(missionUUID, name);
    }

    @Get('filteredMinimal')
    @UserOnly()
    async filteredMissionsMinimal(
        @QueryUUID('uuid', 'Project UUID') uuid: string,
        @QueryOptionalString('search', 'Search in mission name') search: string,
        @QuerySortDirection('descending') descending: boolean,
        @QuerySortBy('sortBy') sortBy: string,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @addUser() user: AuthRes,
    ) {
        return this.missionService.findMissionByProjectMinimal(
            uuid,
            skip,
            take,
            search,
            descending,
            sortBy,
            user.user.uuid,
        );
    }

    @Get('filtered')
    @UserOnly()
    async filteredMissions(
        @QueryUUID('uuid', 'Project UUID') uuid: string,
        @QueryOptionalString('search', 'Search in mission name') search: string,
        @QuerySortDirection('descending') descending: boolean,
        @QuerySortBy('sortBy') sortBy: string,
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
    async getMissionById(@QueryUUID('uuid', 'Mission UUID') uuid: string) {
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
    async filteredByProjectName(
        @QueryString('projectName', 'Project Name') projectName: string,
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
        @QueryUUID('missionUUID', 'Mission UUID') missionUUID: string,
        @QueryUUID('projectUUID', 'Project UUID') projectUUID: string,
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
    async getManyMissions(@QueryStringArray('uuids', 'List of Mission UUIDs') uuids: string[]) {
        return this.missionService.findMany(uuids);
    }
}
