import { ApiCreatedResponse, ApiOkResponse } from '@/decorators';
import { MetadataService } from '@/services/metadata.service';
import {
    CreateTagTypeDto,
    FilteredMetadataTypesQueryDto,
    PaginatedQueryDto,
    TagTypeDto,
    TagTypesDto,
} from '@kleinkram/api-dto';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CanCreate, LoggedIn } from '../auth/roles.decorator';

@Controller('metadata-types')
export class MetadataTypeController {
    constructor(private readonly metadataService: MetadataService) {}

    @Post()
    @CanCreate()
    @ApiCreatedResponse({
        description: 'Returns the created TagType',
        type: TagTypeDto,
    })
    async createTagType(@Body() body: CreateTagTypeDto): Promise<TagTypeDto> {
        return await this.metadataService.create(body.name, body.type);
    }

    @Get()
    @LoggedIn()
    @ApiOkResponse({
        description: 'Returns all TagTypes',
        type: TagTypesDto,
    })
    async getAll(@Query() query: PaginatedQueryDto): Promise<TagTypesDto> {
        return this.metadataService.getAll(query.skip, query.take);
    }

    @Get('filtered')
    @LoggedIn()
    @ApiOkResponse({
        description: 'Returns all TagTypes',
        type: TagTypesDto,
    })
    async getFiltered(
        @Query() query: FilteredMetadataTypesQueryDto,
    ): Promise<TagTypesDto> {
        return this.metadataService.getFiltered(
            query.name,
            query.type,
            query.skip,
            query.take,
        );
    }
}
