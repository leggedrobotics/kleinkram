import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class IsUploadingDto {
    @ApiProperty({
        description: 'Is uploading',
        type: Boolean,
    })
    @IsBoolean()
    isUploading!: boolean;
}
