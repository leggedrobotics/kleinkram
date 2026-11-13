import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsString } from 'class-validator';

/**
 * Everything the CLI needs to talk to this Kleinkram instance.
 *
 * Returned by `GET /cli/config` so that `klein login <url>` only needs the
 * address of the web app or the API, and finds the rest itself.
 */
export class CliConfigDto {
    @ApiProperty({
        description: 'Address of the web app',
        example: 'https://datasets.example.org',
    })
    @IsString()
    frontendUrl!: string;

    @ApiProperty({
        description: 'Address of the API',
        example: 'https://api.datasets.example.org',
    })
    @IsString()
    apiUrl!: string;

    @ApiProperty({
        description: 'Address of the S3 storage used for uploads',
        example: 'https://s3.datasets.example.org',
    })
    @IsString()
    s3Url!: string;

    @ApiProperty({ description: 'Version of the server', example: '0.67.0' })
    @IsString()
    serverVersion!: string;

    @ApiProperty({
        description: 'Oldest CLI version the server accepts',
        example: '0.58.0',
    })
    @IsString()
    minCliVersion!: string;

    @ApiProperty({
        description: 'Login providers enabled on this instance',
        example: ['google', 'github'],
        type: [String],
    })
    @IsArray()
    @IsString({ each: true })
    authProviders!: string[];

    @ApiProperty({
        description: 'Whether the device authorization login is available',
    })
    @IsBoolean()
    deviceFlow!: boolean;

    @ApiProperty({
        description: 'Address of the documentation',
        example: 'https://docs.datasets.example.org',
    })
    @IsString()
    docsUrl!: string;
}
