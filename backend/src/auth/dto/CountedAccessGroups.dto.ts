import AccessGroup from '@common/entities/auth/accessgroup.entity';
import { ApiProperty } from '@nestjs/swagger';

export class CountedAccessGroups {
    @ApiProperty()
    entities!: AccessGroup[];

    @ApiProperty()
    total!: number;
}
