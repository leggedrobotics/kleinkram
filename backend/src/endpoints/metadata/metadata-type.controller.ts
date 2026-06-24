import { ApiOkResponse } from '@/decorators';
import { TagService } from '@/services/tag.service';
import {
    QueryOptionalString,
    QuerySkip,
    QueryTake,
} from '@/validation/query-decorators';
import { CreateTagTypeDto, TagTypeDto, TagTypesDto } from '@kleinkram/api-dto';
import { DataType } from '@kleinkram/shared';
import { Body, Controller, Get, Post } from '@nestjs/common';
import { CanCreate, LoggedIn } from '../auth/roles.decorator';

@Controller('metadata-types')
export class MetadataTypeController {
    constructor(private readonly tagService: TagService) {}

    @Post()
    @CanCreate()
    @ApiOkResponse({
        description: 'Returns the created TagType',
        type: TagTypeDto,
    })
    async createTagType(@Body() body: CreateTagTypeDto): Promise<TagTypeDto> {
        return await this.tagService.create(body.name, body.type);
    }

    @Get()
    @LoggedIn()
    @ApiOkResponse({
        description: 'Returns all TagTypes',
        type: TagTypesDto,
    })
    async getAll(
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
    ): Promise<TagTypesDto> {
        return this.tagService.getAll(skip, take);
    }

    @Get('filtered')
    @LoggedIn()
    @ApiOkResponse({
        description: 'Returns all TagTypes',
        type: TagTypesDto,
    })
    async getFiltered(
        @QueryOptionalString('name', 'Filter by TagType name') name: string,
        @QueryOptionalString('type', 'Filter by TagType datatype')
        type: DataType,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
    ): Promise<TagTypesDto> {
        return this.tagService.getFiltered(name, type, skip, take);
    }
}
