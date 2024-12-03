import { Controller, Delete, Get, Post } from '@nestjs/common';
import { TagService } from './tag.service';
import { DataType } from '@common/frontend_shared/enum';
import {
    CanAddTag,
    CanCreate,
    CanDeleteTag,
    LoggedIn,
} from '../auth/roles.decorator';
import {
    BodyDataType,
    BodyNotNull,
    BodyString,
    BodyUUID,
} from '../validation/bodyDecorators';
import {
    QueryOptionalString,
    QuerySkip,
    QueryTake,
} from '../validation/queryDecorators';
import { ParamUUID as ParameterUID } from '../validation/paramDecorators';
import { ApiOkResponse } from '@nestjs/swagger';
import { TagsDto, TagTypesDto } from '@common/api/types/TagsDto.dto';

@Controller('tag')
export class TagController {
    constructor(private readonly tagService: TagService) {}

    @Post('create')
    @CanCreate()
    async createTagType(
        @BodyString('name', 'Tag name') name: string,
        @BodyDataType('type', 'Tag type') type: DataType,
    ) {
        return this.tagService.create(name, type);
    }

    @Post('addTag')
    @CanAddTag()
    async addTag(
        @BodyUUID('mission', 'Mission UUID') mission: string,
        @BodyUUID('tagType', 'TagType UUID') tagType: string,
        @BodyNotNull('value', 'TagType value') value: string | number | boolean,
    ) {
        return this.tagService.addTagType(mission, tagType, value);
    }

    @Post('addTags')
    @CanAddTag()
    async addTags(
        @BodyUUID('uuid', 'Mission UUID') uuid: string,
        @BodyNotNull('tags', 'Record Tagtype UUID to Tag value')
        tags: Record<string, string>,
    ) {
        return this.tagService.addTags(uuid, tags);
    }

    @Delete(':uuid')
    @CanDeleteTag()
    async deleteTag(@ParameterUID('uuid') uuid: string) {
        return this.tagService.deleteTag(uuid);
    }

    @Get('all')
    @LoggedIn()
    @ApiOkResponse({
        description: 'Returns all TagTypes',
        type: TagsDto,
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
