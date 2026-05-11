import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetAccessGroupUserPermissionsDto {
    @IsBoolean()
    @ApiProperty({
        description:
            'Whether the user can edit the group (Owner=true, Member=false).',
        type: Boolean,
        example: true,
    })
    canEditGroup!: boolean;
}
