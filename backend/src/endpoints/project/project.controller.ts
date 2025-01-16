import { Body, Controller, Delete, Get, Post, Put } from '@nestjs/common';
import { ProjectService } from '../../services/project.service';
import { CreateProject } from '@common/api/types/create-project.dto';
import { ProjectQueryDto } from '@common/api/types/project/project-query.dto';

import { Query, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOkResponse } from '../../decarators';
import { ProjectsDto } from '@common/api/types/project/projects.dto';
import { ProjectWithMissionsDto } from '@common/api/types/project/project-with-missions.dto';
import { AddUser, AuthHeader } from '../auth/parameter-decorator';

@Controller('projects')
export class ProjectController {
    constructor(private readonly projectService: ProjectService) {}

    @Post()
    @ApiOkResponse({
        description: 'Returns the updated project',
        type: ProjectWithMissionsDto,
    })
    async createProject(
        @Body() dto: CreateProject,
        @AddUser() user: AuthHeader,
    ): Promise<ProjectWithMissionsDto> {
        return this.projectService.create(dto, user);
    }

    @Get(':uuid')
    async getProject(
        @Param('uuid', ParseUUIDPipe) uuid: string,
    ): Promise<ProjectWithMissionsDto> {
        return this.projectService.findOne(uuid);
    }

    @Put(':uuid')
    async updateProject(
        @Param('uuid', ParseUUIDPipe) uuid: string,
        @Body() body: CreateProject,
    ): Promise<ProjectWithMissionsDto> {
        return this.projectService.update(uuid, body);
    }

    @Delete(':uuid')
    async deleteProject(
        @Param('uuid', ParseUUIDPipe) uuid: string,
    ): Promise<void> {
        return this.projectService.deleteProject(uuid);
    }

    @Get()
    async getProjects(
        @Query() query: ProjectQueryDto,
        @AddUser() user: AuthHeader,
    ): Promise<ProjectsDto> {
        return await this.projectService.findMany(
            query.projectUuids ?? [],
            query.projectPatterns ?? [],
            query.skip,
            query.take,
            user.user.uuid,
        );
    }

    @Post(':missionId/metadata/:id')
    async addMetadataKeyValuePair(): Promise<void> {
        throw new Error('Not implemented');
    }

    @Delete(':missionId/metadata/:id')
    async deleteMetadataKeyValuePair(): Promise<void> {
        throw new Error('Not implemented');
    }

    @Put(':missionId/metadata')
    async updateMetadataKeyValuePairs(): Promise<void> {
        throw new Error('Not implemented');
    }
}
