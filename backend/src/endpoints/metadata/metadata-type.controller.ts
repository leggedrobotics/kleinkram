import { ApiCreatedResponse, ApiOkResponse } from '@/decorators';
import { MetadataService } from '@/services/metadata.service';
import {
    CreateMetadataTypeDto,
    FilteredMetadataTypesQueryDto,
    MetadataTypeDto,
    MetadataTypesDto,
    PaginatedQueryDto,
} from '@kleinkram/api-dto';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CanCreate, LoggedIn } from '../auth/roles.decorator';

@Controller('metadata-types')
export class MetadataTypeController {
    constructor(private readonly metadataService: MetadataService) {}

    @Post()
    @CanCreate()
    @ApiCreatedResponse({
        description: 'Returns the created metadata type',
        type: MetadataTypeDto,
    })
    async createMetadataType(
        @Body() body: CreateMetadataTypeDto,
    ): Promise<MetadataTypeDto> {
        return await this.metadataService.createMetadataType(
            body.name,
            body.type,
        );
    }

    @Get()
    @LoggedIn()
    @ApiOkResponse({
        description: 'Returns all metadata types',
        type: MetadataTypesDto,
    })
    async getAll(@Query() query: PaginatedQueryDto): Promise<MetadataTypesDto> {
        return this.metadataService.getAll(query.skip, query.take);
    }

    @Get('filtered')
    @LoggedIn()
    @ApiOkResponse({
        description: 'Returns all metadata types',
        type: MetadataTypesDto,
    })
    async getFiltered(
        @Query() query: FilteredMetadataTypesQueryDto,
    ): Promise<MetadataTypesDto> {
        return this.metadataService.getFiltered(
            query.name,
            query.type,
            query.skip,
            query.take,
        );
    }
}
