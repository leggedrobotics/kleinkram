import { Controller, Get, Post } from '@nestjs/common';
import { CategoryService } from './category.service';
import { QueryOptionalString, QueryUUID } from '../validation/queryDecorators';
import {
    CanCreateInProjectByBody,
    CanReadProject,
} from '../auth/roles.decorator';
import { addUser, AuthRes } from '../auth/paramDecorator';
import { BodyString, BodyUUID } from '../validation/bodyDecorators';

@Controller('category')
export class CategoryController {
    constructor(private readonly categoryService: CategoryService) {}

    @Get('all')
    @CanReadProject()
    async getAll(
        @QueryUUID('uuid') uuid: string,
        @addUser() user: AuthRes,
        @QueryOptionalString('filter') filter?: string,
    ) {
        return this.categoryService.getAll(uuid, filter);
    }

    @Post('create')
    @CanCreateInProjectByBody()
    async createCategory(
        @BodyString('name') name: string,
        @addUser() user: AuthRes,
        @BodyUUID('projectUUID') projectUUID: string,
    ) {
        return this.categoryService.create(name, projectUUID, user);
    }
}
