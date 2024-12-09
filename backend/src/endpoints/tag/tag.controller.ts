import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { TagService } from '../../services/tag.service';
import { DataType } from '@common/frontend_shared/enum';
import {
    CanAddTag,
    CanCreate,
    CanDeleteTag,
    LoggedIn,
} from '../auth/roles.decorator';
import { BodyNotNull, BodyUUID } from '../../validation/bodyDecorators';
import {
    QueryOptionalString,
    QuerySkip,
    QueryTake,
} from '../../validation/queryDecorators';
import { ParamUUID as ParameterUID } from '../../validation/paramDecorators';
import { ApiOkResponse, OutputDto } from '../../decarators';
import { TagTypeDto, TagTypesDto } from '@common/api/types/tags/tags.dto';
import { CreateTagTypeDto } from '@common/api/types/tags/create-tag-type.dto';

@Controller('tag')
export class TagController {
    constructor(private readonly tagService: TagService) {}

    @Post('create')
    @CanCreate()
    @ApiOkResponse({
        description: 'Returns the created TagType',
        type: TagTypeDto,
    })
    async createTagType(@Body() body: CreateTagTypeDto): Promise<TagTypeDto> {
        return await this.tagService.create(body.name, body.type);
    }

    @Post('addTag')
    @CanAddTag()
    @OutputDto(null) // TODO: type API response
    async addTag(
        @BodyUUID('mission', 'Mission UUID') mission: string,
        @BodyUUID('tagType', 'TagType UUID') tagType: string,
        @BodyNotNull('value', 'TagType value') value: string | number | boolean,
    ) {
        return this.tagService.addTagType(mission, tagType, value);
    }

    @Post('addTags')
    @CanAddTag()
    @OutputDto(null) // TODO: type API response
    async addTags(
        @BodyUUID('uuid', 'Mission UUID') uuid: string,
        @BodyNotNull('tags', 'Record Tagtype UUID to Tag value')
        tags: Record<string, string>,
    ) {
        return this.tagService.addTags(uuid, tags);
    }

    @Delete(':uuid')
    @CanDeleteTag()
    @OutputDto(null) // TODO: type API response
    async deleteTag(@ParameterUID('uuid') uuid: string) {
        return this.tagService.deleteTag(uuid);
    }

    @Get('all')
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
