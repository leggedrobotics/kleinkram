import { ApiOkResponse } from '@/decorators';
import { AccessQueryService } from '@/services/access-query.service';
import {
    AccessGroupsDto,
    GetFilteredAccessGroupsDto,
} from '@kleinkram/api-dto';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { AddUser, AuthHeader } from '../auth/parameter-decorator';
import { UserOnly } from '../auth/roles.decorator';

/**
 * The current user's access groups, next to the other `/users/me/*` routes.
 *
 * Lives in the access module rather than `UserController`: `AccessModule`
 * already imports `UserModule`, so the reverse import would be circular.
 */
@Controller('users/me/access-groups')
export class MyAccessGroupsController {
    constructor(private readonly accessQueryService: AccessQueryService) {}

    @Get()
    @UserOnly()
    @ApiOperation({
        summary: 'List the access groups of the current user',
        description:
            'Lists the access groups the current user is an active member of, including their primary group. Available to all users, including external users. Member emails are not included.',
    })
    @ApiOkResponse({
        description: 'The access groups of the current user',
        type: AccessGroupsDto,
    })
    async listMine(
        @Query() query: GetFilteredAccessGroupsDto,
        @AddUser() user: AuthHeader,
    ): Promise<AccessGroupsDto> {
        return this.accessQueryService.listMyAccessGroups(
            user.user.uuid,
            query.search,
            query.type,
            query.skip,
            query.take,
        );
    }
}
