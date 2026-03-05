import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class DeleteAccessGroupResponseDto {
    @ApiProperty({
        description: 'Indicates the deletion was successful',
        example: true,
        type: Boolean,
    })
    @IsBoolean()
    success!: boolean;
}
