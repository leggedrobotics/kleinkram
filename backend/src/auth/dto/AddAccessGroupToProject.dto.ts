import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RemoveAccessGroupFromProjectDto } from './RemoveAccessGroupFromProject.dto';

import { AccessGroupRights } from '@common/frontend_shared/enum';

export class AddAccessGroupToProjectDto extends RemoveAccessGroupFromProjectDto {
    @IsEnum(AccessGroupRights)
    @ApiProperty({
        description: 'Access Group Rights',
        format: 'AccessGroupRights',
        enum: AccessGroupRights,
    })
    rights: AccessGroupRights;
}
