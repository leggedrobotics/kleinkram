import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class DeleteTemplateResponseDto {
    @ApiProperty({
        description: 'True if the template was archived instead of deleted',
    })
    @IsBoolean()
    archived!: boolean;

    @ApiProperty({
        description: 'True if the template was permanently deleted',
    })
    @IsBoolean()
    deleted!: boolean;
}
