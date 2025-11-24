import { ApiProperty } from '@nestjs/swagger';
import { IsUrl } from 'class-validator';

export class FoxgloveLinkResponseDto {
    @ApiProperty()
    @IsUrl({
        require_tld: false, // Allows 'localhost'
    })
    url!: string;
}
