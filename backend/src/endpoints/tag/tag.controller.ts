import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { TagService } from '../../services/tag.service';
import { DataType } from '@common/frontend_shared/enum';
import { Query } from '@nestjs/common';
import {
    CanAddTag,
    CanCreate,
    CanDeleteTag,
    LoggedIn,
} from '../auth/roles.decorator';
import { BodyNotNull, BodyUUID } from '../../validation/body-decorators';
import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ParameterUuid as ParameterUID } from '../../validation/parameter-decorators';
import { ApiOkResponse } from '../../decarators';
import { TagTypeDto, TagTypesDto } from '@common/api/types/tags/tags.dto';
import { CreateTagTypeDto } from '@common/api/types/tags/create-tag-type.dto';
import { DeleteTagDto } from '@common/api/types/tags/delete-tag.dto';
import { AddTagDto, AddTagsDto } from '@common/api/types/tags/add-tags.dto';
import { PaginatedQueryDto } from '@common/api/types/pagination.dto';
import { ApiProperty } from '@nestjs/swagger';

class FilteredTagQueryDto {
    @IsOptional()
    @IsString()
    @ApiProperty()
    name?: string;

    @IsOptional()
    @IsEnum(DataType)
    @ApiProperty()
    type?: DataType;
}

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
    @ApiOkResponse({
        type: AddTagDto,
    })
    async addTag(
        @BodyUUID('mission', 'Mission UUID') mission: string,
        @BodyUUID('tagType', 'TagType UUID') tagType: string,
        @BodyNotNull('value', 'TagType value') value: string | number | boolean,
    ): Promise<AddTagDto> {
        return this.tagService.addTagType(mission, tagType, value);
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
    async getAll(@Query() query: PaginatedQueryDto): Promise<TagTypesDto> {
        return this.tagService.getAll(query.skip, query.take);
    }

    @Get('filtered')
    @LoggedIn()
    @ApiOkResponse({
        description: 'Returns all TagTypes',
        type: TagTypesDto,
    })
    async getFiltered(
        @Query() query: FilteredTagQueryDto & PaginatedQueryDto,
    ): Promise<TagTypesDto> {
        return this.tagService.getFiltered(
            query.name,
            query.type,
            query.skip,
            query.take,
        );
    }
}
