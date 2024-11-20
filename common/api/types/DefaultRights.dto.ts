import { ApiProperty } from '@nestjs/swagger';
import { AccessGroupRights, AccessGroupType } from '../../frontend_shared/enum';

export class DefaultRightDto {
    @ApiProperty()
    name: string;

    @ApiProperty()
    uuid: string;

    @ApiProperty()
    type: AccessGroupType;

    @ApiProperty()
    rights: AccessGroupRights;
}

export class DefaultRightsDto {
    @ApiProperty()
    count: number;

    @ApiProperty({
        type: [DefaultRightDto],
        description: 'List of default rights',
    })
    defaultRights: DefaultRightDto[];
}
