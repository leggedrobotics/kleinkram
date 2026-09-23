import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class DeleteTagDto {
    @ApiProperty({
        description: 'Indicates the deletion was successful',
        example: true,
        type: Boolean,
    })
    @IsBoolean()
    success!: boolean;
}
