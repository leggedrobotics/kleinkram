import {
    ActionTemplateDto,
    ActionTemplatesDto,
    ActionTemplatesQueryDto,
    CreateTemplateDto,
    PaginatedQueryDto,
    UpdateTemplateDto,
} from '@kleinkram/api-dto';
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

import { ApiCreatedResponse, ApiOkResponse, OutputDto } from '@/decorators';
import { TemplateService } from '@/services/template.service';
import { ParameterUuid } from '@/validation/parameter-decorators';
import { ActionTemplateAvailabilityDto } from '@kleinkram/api-dto';
import { AddUser, AuthHeader } from '../auth/parameter-decorator';
import { CanCreate, LoggedIn } from '../auth/roles.decorator';

@ApiTags('Templates')
@Controller('templates')
export class TemplatesController {
    constructor(private readonly templateService: TemplateService) {}

    @Post()
    @CanCreate()
    @ApiOperation({ summary: 'Create a new action template' })
    @ApiCreatedResponse({ type: ActionTemplateDto })
    async createNewTemplate(
        @Body() dto: CreateTemplateDto,
        @AddUser() user: AuthHeader,
    ): Promise<ActionTemplateDto> {
        return this.templateService.create(dto, user);
    }

    @Post(':uuid/versions')
    @CanCreate()
    @ApiOperation({ summary: 'Create a new version of an existing template' })
    @ApiCreatedResponse({ type: ActionTemplateDto })
    async createNewTemplateVersion(
        @Body() dto: UpdateTemplateDto,
        @AddUser() user: AuthHeader,
    ): Promise<ActionTemplateDto> {
        return this.templateService.createVersion(dto, user);
    }

    @Get()
    @LoggedIn()
    @ApiOperation({ summary: 'List action templates' })
    @ApiOkResponse({
        description: 'List of action templates',
        type: ActionTemplatesDto,
    })
    async findAllTemplates(
        @Query() query: ActionTemplatesQueryDto,
    ): Promise<ActionTemplatesDto> {
        return this.templateService.findAll(
            query.skip,
            query.take,
            query.search,
            query.includeArchived,
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
        @Query() query: PaginatedQueryDto,
    ): Promise<ActionTemplatesDto> {
        return this.templateService.findRevisions(uuid, query.skip, query.take);
    }

    @Delete(':uuid')
    @CanCreate()
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Archive or delete a template' })
    @OutputDto(null)
    async removeTemplate(@ParameterUuid('uuid') uuid: string): Promise<void> {
        await this.templateService.delete(uuid);
    }
}
