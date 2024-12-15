import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RemoveAccessGroupFromProjectDto } from './remove-access-group-project.dto';
import { AccessGroupRights } from '../../frontend_shared/enum';

export class AddAccessGroupToProjectDto extends RemoveAccessGroupFromProjectDto {
    @IsEnum(AccessGroupRights)
    @ApiProperty({
        description: 'Access Group Rights',
        format: 'AccessGroupRights',
        enum: AccessGroupRights,
    })
    rights!: AccessGroupRights;
}
