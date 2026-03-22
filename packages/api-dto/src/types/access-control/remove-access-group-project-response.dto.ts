import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class RemoveAccessGroupFromProjectResponseDto {
    @ApiProperty({
        description: 'Indicates the deletion was successful',
        example: true,
        type: Boolean,
    })
    @IsBoolean()
    success!: boolean;
}
