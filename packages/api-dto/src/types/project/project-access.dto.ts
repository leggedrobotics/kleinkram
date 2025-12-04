import { ProjectDto } from '@api-dto/project/base-project.dto';
import { AccessGroupRights } from '@kleinkram/shared';
import { IsEnum } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

export class ProjectWithAccessRightsDto extends ProjectDto {
    @ApiProperty({
        description: 'Access Group Rights',
        format: 'AccessGroupRights',
        enum: AccessGroupRights,
    })
    @IsEnum(AccessGroupRights)
    rights!: AccessGroupRights;
}
