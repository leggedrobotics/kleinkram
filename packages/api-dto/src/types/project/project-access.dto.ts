import { ProjectDto } from '@api-dto/project/base-project.dto';
import { AccessGroupRights } from '@kleinkram/shared';
import { Expose } from 'class-transformer';
import { IsEnum } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

@Expose()
export class ProjectWithAccessRightsDto extends ProjectDto {
    @ApiProperty({
        description: 'Access Group Rights',
        format: 'AccessGroupRights',
        enum: AccessGroupRights,
    })
    @IsEnum(AccessGroupRights)
    @Expose()
    rights!: AccessGroupRights;
}
