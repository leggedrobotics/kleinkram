import { ApiProperty } from '@nestjs/swagger';
import { IsUrl } from 'class-validator';

export class DownloadResponseDto {
    @ApiProperty()
    @IsUrl({
        // eslint-disable-next-line @typescript-eslint/naming-convention
        require_tld: false,
    })
    url!: string;
}
