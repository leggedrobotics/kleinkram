import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { MissionService } from '../../services/mission.service';
import { CreateMission } from '@common/api/types/create-mission.dto';
import {
    CanCreateInProjectByBody,
    CanDeleteMission,
    CanReadMission,
    UserOnly,
} from '../auth/roles.decorator';
import { Query, Param } from '@nestjs/common';

import { ApiOkResponse } from '../../decarators';
import { Put } from '@nestjs/common';
import {
    FlatMissionDto,
    MissionsDto,
    MissionWithFilesDto,
} from '@common/api/types/mission/mission.dto';

import { MissionQueryDto } from '@common/api/types/mission/mission-query.dto';

import { AddUser, AuthHeader } from '../auth/parameter-decorator';

@Controller('missions')
export class MissionController {
    constructor(private readonly missionService: MissionService) {}

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

    @Get(':uuid')
    @CanReadMission()
    @ApiOkResponse({
        description: 'Returns the mission',
        type: MissionWithFilesDto,
    })
    async getMissionById(
        @Param('uuid') uuid: string,
    ): Promise<MissionWithFilesDto> {
        return this.missionService.findOne(uuid);
    }

    @Put(':uuid')
    @CanReadMission()
    @ApiOkResponse({
        description: 'Returns the mission',
        type: MissionWithFilesDto,
    })
    async updateMission(
        @Param('uuid') uuid: string,
    ): Promise<MissionWithFilesDto> {
        // TODO: needs to update metadata and be able to move mission
        return this.missionService.findOne(uuid);
    }

    @Delete(':uuid')
    @CanDeleteMission()
    async deleteMission(@Param('uuid') uuid: string): Promise<void> {
        return this.missionService.deleteMission(uuid);
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
            query.skip,
            query.take,
            user.user.uuid,
        );
    }

    @Post(':uuid/download')
    @CanReadMission()
    async downloadWithToken(@Param('uuid') uuid: string) {
        return this.missionService.download(uuid);
    }
}
