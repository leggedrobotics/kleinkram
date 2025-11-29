import { ActionTemplateDto } from '@common/api/types/actions/action-template.dto';
import { ActionTemplatesDto } from '@common/api/types/actions/action-templates.dto';
import { CreateTemplateDto } from '@common/api/types/actions/create-template.dto';
import { UpdateTemplateDto } from '@common/api/types/actions/update-template.dto';
import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Post,
    Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ActionTemplateAvailabilityDto } from '@common/api/types/actions/action-template-availability.dto';
import { ApiOkResponse, OutputDto } from '../../decarators';
import { TemplateService } from '../../services/template.service';
import { ParameterUuid } from '../../validation/parameter-decorators';
import { QuerySkip, QueryTake } from '../../validation/query-decorators';
import { AddUser, AuthHeader } from '../auth/parameter-decorator';
import { CanCreate, LoggedIn } from '../auth/roles.decorator';

@ApiTags('Templates')
@Controller('templates')
export class TemplatesController {
    constructor(private readonly templateService: TemplateService) {}

    @Post()
    @CanCreate()
    @ApiOperation({ summary: 'Create a new action template' })
    @ApiOkResponse({ type: ActionTemplateDto })
    async createNewTemplate(
        @Body() dto: CreateTemplateDto,
        @AddUser() user: AuthHeader,
    ): Promise<ActionTemplateDto> {
        return this.templateService.create(dto, user);
    }

    @Post(':uuid/versions')
    @CanCreate()
    @ApiOperation({ summary: 'Create a new version of an existing template' })
    @ApiOkResponse({ type: ActionTemplateDto })
    async createNewTemplateVersion(
        @ParameterUuid('uuid') uuid: string,
        @Body() dto: UpdateTemplateDto,
        @AddUser() user: AuthHeader,
    ): Promise<ActionTemplateDto> {
        return this.templateService.createVersion(uuid, dto, user);
    }

    @Get()
    @LoggedIn()
    @ApiOperation({ summary: 'List action templates' })
    @ApiOkResponse({
        description: 'List of action templates',
        type: ActionTemplatesDto,
    })
    async findAllTemplates(
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @Query('search') search?: string,
        @Query('includeArchived') includeArchived?: boolean,
    ): Promise<ActionTemplatesDto> {
        return this.templateService.findAll(
            skip,
            take,
            search,
            includeArchived,
        );
    }

    @Get('availability')
    @CanCreate()
    @ApiOperation({ summary: 'Check if a template name is available' })
    @ApiOkResponse({ type: ActionTemplateAvailabilityDto })
    async checkTemplateNameAvailability(
        @Query('name') name: string,
    ): Promise<ActionTemplateAvailabilityDto> {
        const available = await this.templateService.isNameAvailable(name);
        return { available };
    }

    @Get(':uuid/revisions')
    @LoggedIn()
    @ApiOperation({ summary: 'Get history/revisions of a template' })
    @ApiOkResponse({ type: ActionTemplatesDto })
    async findTemplateRevisions(
        @ParameterUuid('uuid') uuid: string,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
    ): Promise<ActionTemplatesDto> {
        return this.templateService.findRevisions(uuid, skip, take);
    }

    @Delete(':uuid')
    @CanCreate()
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Archive or delete a template' })
    // eslint-disable-next-line unicorn/no-null
    @OutputDto(null)
    async removeTemplate(@ParameterUuid('uuid') uuid: string): Promise<void> {
        await this.templateService.delete(uuid);
    }
}
