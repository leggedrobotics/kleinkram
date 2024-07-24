import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { TagService } from './tag.service';
import { DataType } from '@common/enum';
import { CanAddTag, CanDeleteTag, LoggedIn } from '../auth/roles.decorator';

@Controller('tag')
export class TagController {
    constructor(private readonly tagService: TagService) {}

    @Post('create')
    @LoggedIn()
    async createTagType(
        @Body('name') name: string,
        @Body('type') type: DataType,
    ) {
        return this.tagService.create(name, type);
    }

    @Post('addTag')
    @CanAddTag()
    async addTag(
        @Body('mission') mission: string,
        @Body('tagType') tagType: string,
        @Body('value') value: string,
    ) {
        return this.tagService.addTagType(mission, tagType, value);
    }

    @Post('addTags')
    @CanAddTag()
    async addTags(
        @Body('mission') uuid: string,
        @Body('tags') tags: Record<string, string>,
    ) {
        return this.tagService.addTags(uuid, tags);
    }

    @Delete('deleteTag')
    @CanDeleteTag()
    async deleteTag(@Query('uuid') uuid: string) {
        return this.tagService.deleteTag(uuid);
    }

    @Get('all')
    @LoggedIn()
    async getAll() {
        return this.tagService.getAll();
    }
}
