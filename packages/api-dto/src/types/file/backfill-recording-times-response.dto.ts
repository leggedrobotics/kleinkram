import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber } from 'class-validator';

export class BackfillRecordingTimesResponseDto {
    @ApiProperty()
    @IsBoolean()
    success!: boolean;

    @ApiProperty({
        description: 'Number of files queued for recording time recovery',
    })
    @IsNumber()
    fileCount!: number;
}
