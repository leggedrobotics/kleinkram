import {
    AccessGroupRights,
    GRANTABLE_ACCESS_GROUP_RIGHTS,
} from '@kleinkram/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    ArrayNotEmpty,
    ArrayUnique,
    IsArray,
    IsIn,
    IsUUID,
    ValidateNested,
} from 'class-validator';
import { MAX_ACCESS_GROUP_BATCH_SIZE } from './add-users-access-group.dto';

export class AccessGroupProjectRightsDto {
    @IsUUID()
    @ApiProperty({ description: 'Project UUID', format: 'uuid' })
    projectUuid!: string;

    @IsIn(GRANTABLE_ACCESS_GROUP_RIGHTS)
    @ApiProperty({
        description: 'Access Group Rights',
        format: 'AccessGroupRights',
        enum: GRANTABLE_ACCESS_GROUP_RIGHTS,
    })
    rights!: AccessGroupRights;
}

export class AddAccessGroupToProjectsDto {
    @IsArray()
    @ArrayNotEmpty()
    @ArrayMaxSize(MAX_ACCESS_GROUP_BATCH_SIZE)
    @ArrayUnique((entry: unknown) => {
        const projectUuid = (entry as { projectUuid?: unknown } | null)
            ?.projectUuid;
        return typeof projectUuid === 'string'
            ? projectUuid.toLowerCase()
            : entry;
    })
    @ValidateNested({ each: true })
    @Type(() => AccessGroupProjectRightsDto)
    @ApiProperty({
        description:
            'The projects to add the access group to, each with the rights it gets. Either all of them are added or none.',
        type: () => [AccessGroupProjectRightsDto],
        minItems: 1,
        maxItems: MAX_ACCESS_GROUP_BATCH_SIZE,
    })
    projects!: AccessGroupProjectRightsDto[];
}
