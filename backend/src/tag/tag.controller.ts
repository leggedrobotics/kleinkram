import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { TagService } from './tag.service';
import { DataType } from '@common/enum';
import { LoggedIn } from '../auth/roles.decorator';

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
    @LoggedIn()
    async addTag(
        @Query('mission') uuid: string,
        @Query('tagType') tagTypeUUID: string,
        @Query('value') value: string,
    ) {
        return this.tagService.addTagType(uuid, tagTypeUUID, value);
    }

    @Post('deleteTag')
    @LoggedIn()
    async deleteTag(@Query('uuid') uuid: string) {
        return this.tagService.deleteTag(uuid);
    }

    @Get('all')
    @LoggedIn()
    async getAll() {
        return this.tagService.getAll();
    }
}
