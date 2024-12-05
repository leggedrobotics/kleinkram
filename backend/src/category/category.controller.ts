import { Controller, Get, Post } from '@nestjs/common';
import { CategoryService } from './category.service';
import { QueryOptionalString, QueryUUID } from '../validation/queryDecorators';
import {
    CanCreateInProjectByBody,
    CanReadProject,
    CanWriteMissionByBody,
} from '../auth/roles.decorator';
import { AddUser, AuthRes } from '../auth/paramDecorator';
import {
    BodyString,
    BodyUUID,
    BodyUUIDArray,
} from '../validation/bodyDecorators';
import { ApiOkResponse } from '../decarators';
import { CategoriesDto, CategoryDto } from '@common/api/types/Category.dto';

@Controller('category')
export class CategoryController {
    constructor(private readonly categoryService: CategoryService) {}

    @Get('all')
    @CanReadProject()
    @ApiOkResponse({
        description: 'Get all categories in a project',
        type: CategoriesDto,
    })
    async getAll(
        @QueryUUID('uuid', 'Project UUID') uuid: string,
        @QueryOptionalString('filter', 'Filter by Category name')
        filter?: string,
    ): Promise<CategoriesDto> {
        return this.categoryService.getAll(uuid, filter);
    }

    @Post('create')
    @CanCreateInProjectByBody()
    async createCategory(
        @BodyString('name', 'Category Name') name: string,
        @AddUser() user: AuthRes,
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
