import { Controller, Get, Post } from '@nestjs/common';
import { CategoryService } from './category.service';
import { QueryOptionalString, QueryUUID } from '../validation/queryDecorators';
import {
    CanCreateInProjectByBody,
    CanReadProject,
    CanWriteMissionByBody,
} from '../auth/roles.decorator';
import { addUser, AuthRes } from '../auth/paramDecorator';
import {
    BodyString,
    BodyUUID,
    BodyUUIDArray,
} from '../validation/bodyDecorators';

@Controller('category')
export class CategoryController {
    constructor(private readonly categoryService: CategoryService) {}

    @Get('all')
    @CanReadProject()
    async getAll(
        @QueryUUID('uuid', 'Project UUID') uuid: string,
        @addUser() user: AuthRes,
        @QueryOptionalString('filter', 'Filter by Category name')
        filter?: string,
    ) {
        return this.categoryService.getAll(uuid, filter);
    }

    @Post('create')
    @CanCreateInProjectByBody()
    async createCategory(
        @BodyString('name', 'Category Name') name: string,
        @addUser() user: AuthRes,
        @BodyUUID('projectUUID', 'Project UUID') projectUUID: string,
    ) {
        return this.categoryService.create(name, projectUUID, user);
    }

    @Post('addMany')
    @CanWriteMissionByBody()
    async addManyCategories(
        @BodyUUID('missionUUID', 'Mission UUID') missionUUID: string,
        @BodyUUIDArray('files', 'List of File UUID where Categries are added')
        files: string[],
        @BodyUUIDArray('categories', 'List of Category UUID to be added')
        categories: string[],
    ) {
        return this.categoryService.addManyCategories(
            missionUUID,
            files,
            categories,
        );
    }
}
