import { IsEnum } from 'class-validator';
import { AccessGroupRights } from '../../../frontend_shared/enum';
import { ProjectDto } from './base-project.dto';

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
