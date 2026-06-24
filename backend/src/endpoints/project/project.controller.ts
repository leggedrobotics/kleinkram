import {
    ApiCreatedResponse,
    ApiOkResponse,
    ApiResponse,
    OutputDto,
} from '@/decorators';
import { projectEntityToDto } from '@/serialization';
import { AccessService } from '@/services/access.service';
import { ProjectService } from '@/services/project.service';
import { ParameterUuid as ParameterUID } from '@/validation/parameter-decorators';
import { QueryTake } from '@/validation/query-decorators';
import {
    AddMetadataTypeDto,
    AddMetadataTypeQueryDto,
    AddUserToProjectDto,
    CreateProject,
    DefaultRights,
    DeleteProjectResponseDto,
    ProjectAccessDto,
    ProjectAccessListDto,
    ProjectDto,
    ProjectQueryDto,
    ProjectsDto,
    ProjectWithRequiredTagsDto,
    RemoveTagTypeDto,
    ResentProjectsDto,
    UpdateMetadataTypesBodyDto,
    UpdateMetadataTypesDto,
} from '@kleinkram/api-dto';
import {
    Body,
    Controller,
    Delete,
    Get,
    ParseArrayPipe,
    Post,
    Put,
    Query,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { AddUser, AuthHeader } from '../auth/parameter-decorator';
import {
    CanCreate,
    CanDeleteProject,
    CanReadProject,
    CanWriteProject,
    LoggedIn,
    UserOnly,
} from '../auth/roles.decorator';

@Controller(['projects'])
export class ProjectController {
    constructor(
        private readonly projectService: ProjectService,
        private readonly accessService: AccessService,
    ) {}

    @Post()
    @CanCreate()
    @ApiCreatedResponse({
        description: 'Returns the created project',
        type: ProjectDto,
    })
    async createProject(
        @Body() dto: CreateProject,
        @AddUser() user: AuthHeader,
    ): Promise<ProjectDto> {
        return this.projectService.create(dto, user);
    }

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

    @Get('default-rights')
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

    @Get(':uuid')
    @CanReadProject()
    @ApiOkResponse({
        description: 'Returns the project macthing the uuid.',
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
        // Convert string 'true'/'false' to boolean
        const exactMatch = query.exactMatch === 'true';

        return await this.projectService.findMany(
            query.projectUuids ?? [],
            query.projectPatterns ?? [],
            query.sortBy,
            query.sortOrder,
            query.skip,
            query.take,
            query.creatorUuid,
            user.user.uuid,
            exactMatch,
        );
    }

    @ApiOperation({
        summary: 'Add User to Project',
        description: 'Adds a user to a project with the given rights.',
    })
    @ApiCreatedResponse({
        type: ProjectDto,
        description: 'The Project the user was added to.',
    })
    @Post(':uuid/users')
    @CanWriteProject()
    @OutputDto(ProjectDto)
    async addUserToProject(
        @ParameterUID('uuid', 'UUID of Project') uuid: string,
        @Body() body: AddUserToProjectDto,
        @AddUser() requestUser: AuthHeader,
    ): Promise<ProjectDto> {
        const projectEntity = await this.accessService.addUserToProject(
            uuid,
            body.userUuid,
            body.rights,
            requestUser,
        );
        return projectEntityToDto(projectEntity);
    }

    @Post(':uuid/metadata-types')
    @CanWriteProject()
    @ApiCreatedResponse({
        description: 'Empty response',
        type: AddMetadataTypeDto,
    })
    async addTagType(
        @ParameterUID('uuid') uuid: string,
        @Query() query: AddMetadataTypeQueryDto,
    ): Promise<AddMetadataTypeDto> {
        const typeUuid = query.metadataTypeUUID ?? query.tagTypeUUID ?? '';
        await this.projectService.addTagType(uuid, typeUuid);
        return {};
    }

    @Delete(':uuid/metadata-types/:typeUuid')
    @CanWriteProject()
    @ApiOkResponse({
        type: RemoveTagTypeDto,
        description: 'Empty response',
    })
    async removeTagType(
        @ParameterUID('uuid') uuid: string,
        @ParameterUID('typeUuid') typeUuid: string,
    ): Promise<RemoveTagTypeDto> {
        await this.projectService.removeTagType(uuid, typeUuid);
        return {};
    }

    @Put(':uuid/metadata-types')
    @CanWriteProject()
    @ApiOkResponse({
        description: 'Empty response',
        type: UpdateMetadataTypesDto,
    })
    async updateTagTypes(
        @ParameterUID('uuid') uuid: string,
        @Body() body: UpdateMetadataTypesBodyDto,
    ): Promise<UpdateMetadataTypesDto> {
        const uuids = body.metadataTypeUUIDs ?? body.tagTypeUUIDs ?? [];
        await this.projectService.updateTagTypes(uuid, uuids);
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
    @ApiCreatedResponse({
        description: 'Returns the project access',
        type: ProjectAccessListDto,
    })
    async updateProjectAccess(
        @ParameterUID('uuid') uuid: string,
        @Body(new ParseArrayPipe({ items: ProjectAccessDto }))
        body: ProjectAccessDto[],
        @AddUser() auth: AuthHeader,
    ): Promise<ProjectAccessListDto> {
        return this.accessService.updateProjectAccess(uuid, body, auth);
    }
}
