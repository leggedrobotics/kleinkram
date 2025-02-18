import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { TagService } from '../../services/tag.service';
import { DataType } from '@common/frontend_shared/enum';
import {
    CanAddTag,
    CanCreate,
    CanDeleteTag,
    LoggedIn,
} from '../auth/roles.decorator';
import { BodyNotNull, BodyUUID } from '../../validation/body-decorators';
import {
    QueryOptionalString,
    QuerySkip,
    QueryTake,
} from '../../validation/query-decorators';
import { ParameterUuid as ParameterUID } from '../../validation/parameter-decorators';
import { ApiOkResponse } from '../../decarators';
import { TagTypeDto, TagTypesDto } from '@common/api/types/tags/tags.dto';
import { CreateTagTypeDto } from '@common/api/types/tags/create-tag-type.dto';
import { DeleteTagDto } from '@common/api/types/tags/delete-tag.dto';
import { AddTagsDto } from '@common/api/types/tags/add-tags.dto';

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

    @Post('addTags')
    @CanAddTag()
    @ApiOkResponse({
        type: AddTagsDto,
    })
    async addTags(
        @BodyUUID('uuid', 'Mission UUID') uuid: string,
        @BodyNotNull('tags', 'Record Tagtype UUID to Tag value')
        tags: Record<string, string>,
    ): Promise<AddTagsDto> {
        return this.tagService.addTags(uuid, tags);
    }

    @Delete(':uuid')
    @CanDeleteTag()
    @ApiOkResponse({
        type: DeleteTagDto,
    })
    async deleteTag(@ParameterUID('uuid') uuid: string): Promise<DeleteTagDto> {
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
