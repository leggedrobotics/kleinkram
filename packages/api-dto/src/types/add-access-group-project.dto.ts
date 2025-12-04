import { RemoveAccessGroupFromProjectDto } from '@api-dto/remove-access-group-project.dto';
import { AccessGroupRights } from '@kleinkram/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class AddAccessGroupToProjectDto extends RemoveAccessGroupFromProjectDto {
    @IsEnum(AccessGroupRights)
    @ApiProperty({
        description: 'Access Group Rights',
        format: 'AccessGroupRights',
        enum: AccessGroupRights,
    })
    rights!: AccessGroupRights;
}
