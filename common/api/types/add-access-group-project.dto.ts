import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { AccessGroupRights } from '../../frontend_shared/enum';
import { RemoveAccessGroupFromProjectDto } from './remove-access-group-project.dto';

export class AddAccessGroupToProjectDto extends RemoveAccessGroupFromProjectDto {
    @IsEnum(AccessGroupRights)
    @ApiProperty({
        description: 'Access Group Rights',
        format: 'AccessGroupRights',
        enum: AccessGroupRights,
    })
    rights!: AccessGroupRights;
}
