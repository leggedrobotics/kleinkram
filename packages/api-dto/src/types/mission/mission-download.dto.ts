import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl } from 'class-validator';

export class MissionDownloadEntryDto {
    @ApiProperty({
        description: 'The name of the file',
    })
    @IsString()
    filename!: string;

    @ApiProperty({
        description: 'The download URL of the file',
    })
    @IsUrl({
        // eslint-disable-next-line @typescript-eslint/naming-convention
        require_tld: false,
    })
    link!: string;
}
