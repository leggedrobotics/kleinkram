import { DefaultRights } from '@common/api/types/access-control/default-rights';
import {
    ProjectAccessDto,
    ProjectAccessListDto,
} from '@common/api/types/access-control/project-access.dto';
import { AddTagTypeDto } from '@common/api/types/add-tag-type.dto';
import { CreateProject } from '@common/api/types/create-project.dto';
import { ProjectDto } from '@common/api/types/project/base-project.dto';
import { DeleteProjectResponseDto } from '@common/api/types/project/delete-project-response.dto';
import { ProjectQueryDto } from '@common/api/types/project/project-query.dto';
import { ProjectWithRequiredTagsDto } from '@common/api/types/project/project-with-required-tags.dto';
import { ProjectsDto } from '@common/api/types/project/projects.dto';
import { ResentProjectsDto } from '@common/api/types/project/recent-projects.dto';
import { RemoveTagTypeDto } from '@common/api/types/remove-tag-type.dto';
import { UpdateTagTypesDto } from '@common/api/types/update-tag-types.dto';
import {
    Body,
    Controller,
    Delete,
    Get,
    Post,
    Put,
    Query,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ApiOkResponse, ApiResponse, OutputDto } from '../../decarators';
import { AccessService } from '../../services/access.service';
import { ProjectService } from '../../services/project.service';
import { BodyUUIDArray } from '../../validation/body-decorators';
import { ParameterUuid as ParameterUID } from '../../validation/parameter-decorators';
import { QueryTake, QueryUUID } from '../../validation/query-decorators';
import { AddUser, AuthHeader } from '../auth/parameter-decorator';
import {
    CanCreate,
    CanDeleteProject,
    CanReadProject,
    CanWriteProject,
    LoggedIn,
    UserOnly,
} from '../auth/roles.decorator';

@Controller(['project', 'projects']) // TODO: over time we will migrate to 'projects'
export class ProjectController {
    constructor(
        private readonly projectService: ProjectService,
        private readonly accessService: AccessService,
    ) {}

    @Post()
    @CanCreate()
    @ApiOkResponse({
        description: 'Returns the updated project',
        type: ProjectDto,
    })
    async createProject(
        @Body() dto: CreateProject,
        @AddUser() user: AuthHeader,
    ): Promise<ProjectDto> {
        return this.projectService.create(dto, user);
    }

    // dont match filtered, recent, and getDefaultRights, TODO: fix this at some point
    @Get(':uuid')
    @CanReadProject()
    @ApiOkResponse({
        description: 'Returns the project',
        type: ProjectWithRequiredTagsDto,
    })
    async getProjectById(
        @ParameterUID('uuid') uuid: string,
    ): Promise<ProjectWithRequiredTagsDto> {
        return this.projectService.findOne(uuid);
    }

    @Put(':uuid')
    @CanWriteProject()
    @ApiOkResponse({
        description: 'Returns the updated project',
        type: ProjectDto,
    })
    async updateProject(
        @ParameterUID('uuid') uuid: string,
        @Body() dto: CreateProject,
    ): Promise<ProjectDto> {
        return this.projectService.update(uuid, dto);
    }

    @Delete(':uuid')
    @CanDeleteProject()
    @ApiResponse({
        description: 'Project deleted',
        status: 204,
        type: DeleteProjectResponseDto,
    })
    @OutputDto(null) // TODO: add proper output dto
    async deleteProject(@ParameterUID('uuid') uuid: string): Promise<void> {
        return this.projectService.deleteProject(uuid);
    }

    @Get()
    @UserOnly()
    @ApiOkResponse({
        description: 'Returns projects',
        type: ProjectsDto,
    })
    async getMany(
        @Query() query: ProjectQueryDto,
        @AddUser() user: AuthHeader,
    ): Promise<ProjectsDto> {
        return await this.projectService.findMany(
            query.projectUuids ?? [],
            query.projectPatterns ?? [],
            query.sortBy,
            query.sortOrder,
            query.skip,
            query.take,
            query.creatorUuid,
            user.user.uuid,
        );
    }

    @Post(':uuid/addTagType')
    @CanWriteProject()
    @ApiOkResponse({
        description: 'Empty response',
        type: AddTagTypeDto,
    })
    async addTagType(
        @ParameterUID('uuid') uuid: string,
        @QueryUUID('tagTypeUUID', 'TagType UUID') tagTypeUUID: string,
    ): Promise<AddTagTypeDto> {
        await this.projectService.addTagType(uuid, tagTypeUUID);
        return {};
    }

    @Post(':uuid/removeTagType')
    @CanWriteProject()
    @ApiOkResponse({
        type: RemoveTagTypeDto,
        description: 'Empty response',
    })
    async removeTagType(
        @ParameterUID('uuid') uuid: string,
        @QueryUUID('tagTypeUUID', 'TagType UUID') tagTypeUUID: string,
    ): Promise<RemoveTagTypeDto> {
        await this.projectService.removeTagType(uuid, tagTypeUUID);
        return {};
    }

    @Post(':uuid/updateTagTypes')
    @CanWriteProject()
    @ApiOkResponse({
        description: 'Empty response',
        type: UpdateTagTypesDto,
    })
    async updateTagTypes(
        @ParameterUID('uuid') uuid: string,
        @BodyUUIDArray('tagTypeUUIDs', 'List of Tagtype UUID to set')
        tagTypeUUIDs: string[],
    ): Promise<UpdateTagTypesDto> {
        await this.projectService.updateTagTypes(uuid, tagTypeUUIDs);
        return {
            success: true,
        };
    }

    @Get(':uuid/access')
    @CanReadProject()
    @ApiOkResponse({
        description: 'Returns the project access',
        type: ProjectAccessListDto,
    })
    async getProjectAccess(
        @ParameterUID('uuid') uuid: string,
    ): Promise<ProjectAccessListDto> {
        return this.accessService.getProjectAccesses(uuid);
    }

    @Post(':uuid/access')
    @CanWriteProject()
    @ApiOkResponse({
        description: 'Returns the project access',
        type: ProjectAccessListDto,
    })
    async updateProjectAccess(
        @ParameterUID('uuid') uuid: string,
        @Body() body: ProjectAccessDto[],
        @AddUser() auth: AuthHeader,
    ): Promise<ProjectAccessListDto> {
        return this.accessService.updateProjectAccess(uuid, body, auth);
    }
}

// TODO: this controller should get removed at some point,
// filtered and recent will effectively be replaced by `GET /projects`
// for the getDefaultRights endpoint we should make a separate controller that
// does all the access control stuff
@Controller('oldProject')
export class OldProjectController {
    constructor(private readonly projectService: ProjectService) {}

    @Get('recent')
    @UserOnly()
    @ApiOperation({
        summary: 'Get recent projects',
        description:
            'Get the most recent projects the current user has access to',
    })
    @ApiOkResponse({
        description: 'Returns the most recent projects',
        type: ResentProjectsDto,
    })
    async getRecentProjects(
        @QueryTake('take') take: number,
        @AddUser() user: AuthHeader,
    ): Promise<ResentProjectsDto> {
        const projects = await this.projectService.getRecentProjects(
            take,
            user.user,
        );

        return {
            data: projects,
            count: projects.length,
            skip: 0,
            take: projects.length,
        };
    }

    @Get('getDefaultRights')
    @LoggedIn()
    @ApiOperation({
        summary: 'Get default rights',
        description: `Get the default rights for a project, the default rights 
        are the rights that should be assigned to a new project upon creation`,
    })
    @ApiOkResponse({
        description: 'Returns the default rights for a project',
        type: DefaultRights,
    })
    async getDefaultRights(
        @AddUser() user: AuthHeader,
    ): Promise<DefaultRights> {
        return this.projectService.getDefaultRights(user);
    }
}
