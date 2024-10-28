import { Controller, Delete, Get, Post } from '@nestjs/common';
import { TagService } from './tag.service';
import { DataType } from '@common/enum';
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
import { ParamUUID } from '../validation/paramDecorators';
import { addUser, AuthRes } from '../auth/paramDecorator';

@Controller('tag')
export class TagController {
    constructor(private readonly tagService: TagService) {}

    @Post('create')
    @CanCreate()
    async createTagType(
        @BodyString('name') name: string,
        @BodyDataType('type') type: DataType,
        @addUser() user: AuthRes,
    ) {
        return this.tagService.create(name, type);
    }

    @Post('addTag')
    @CanAddTag()
    async addTag(
        @BodyUUID('mission') mission: string,
        @BodyUUID('tagType') tagType: string,
        @BodyNotNull('value') value: string | number | boolean,
    ) {
        return this.tagService.addTagType(mission, tagType, value);
    }

    @Post('addTags')
    @CanAddTag()
    async addTags(
        @BodyUUID('uuid') uuid: string,
        @BodyNotNull('tags') tags: Record<string, string>,
    ) {
        return this.tagService.addTags(uuid, tags);
    }

    @Delete(':uuid')
    @CanDeleteTag()
    async deleteTag(@ParamUUID('uuid') uuid: string) {
        return this.tagService.deleteTag(uuid);
    }

    @Get('all')
    @LoggedIn()
    async getAll(
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
    ) {
        return this.tagService.getAll(skip, take);
    }

    @Get('filtered')
    @LoggedIn()
    async getFiltered(
        @QueryOptionalString('name') name: string,
        @QueryOptionalString('type') type: DataType,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
    ) {
        return this.tagService.getFiltered(name, type, skip, take);
    }
}
