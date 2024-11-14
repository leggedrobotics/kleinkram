import { IsEnum } from 'class-validator';
import { AccessGroupRights } from '@common/enum';
import { ApiProperty } from '@nestjs/swagger';
import { RemoveAccessGroupFromProjectDto } from './RemoveAccessGroupFromProject.dto';

export class AddAccessGroupToProjectDto extends RemoveAccessGroupFromProjectDto {
    @IsEnum(AccessGroupRights)
    @ApiProperty({
        description: 'Access Group Rights',
        format: 'AccessGroupRights',
        enum: AccessGroupRights,
    })
    rights: AccessGroupRights;
}
