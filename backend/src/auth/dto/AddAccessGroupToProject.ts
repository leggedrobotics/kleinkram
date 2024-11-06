import { IsEnum } from 'class-validator';
import { AccessGroupRights } from '@common/enum';
import { ApiProperty } from '@nestjs/swagger';
import { RemoveAccessGroupFromProject } from './RemoveAccessGroupFromProject';

export class AddAccessGroupToProject extends RemoveAccessGroupFromProject{


    @IsEnum(AccessGroupRights)
    @ApiProperty({description:'Access Group Rights'})
    rights: AccessGroupRights;
}