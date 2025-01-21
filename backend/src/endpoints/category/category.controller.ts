import { Controller, Get, Post } from '@nestjs/common';
import { CategoryService } from '../../services/category.service';
import {
    QueryOptionalString,
    QueryUUID,
} from '../../validation/query-decorators';
import {
    CanCreateInProjectByBody,
    CanReadProject,
    CanWriteMissionByBody,
} from '../auth/roles.decorator';
import {
    BodyString,
    BodyUUID,
    BodyUUIDArray,
} from '../../validation/body-decorators';
import { ApiOkResponse, OutputDto } from '../../decarators';
import { CategoriesDto } from '@common/api/types/category.dto';
import { AddUser, AuthHeader } from '../auth/parameter-decorator';

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
    @OutputDto(null) // TODO: type API response
    async createCategory(
        @BodyString('name', 'Category Name') name: string,
        @AddUser() user: AuthHeader,
        @BodyUUID('projectUUID', 'Project UUID') projectUUID: string,
    ) {
        return this.categoryService.create(name, projectUUID, user);
    }
    
    // this should be moved to the file controller
    @Post('addMany')
    @CanWriteMissionByBody()
    @OutputDto(null) // TODO: type API response
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
