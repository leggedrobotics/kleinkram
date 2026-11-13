import { ApiProperty } from '@nestjs/swagger';
import {
    IsDate,
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    MaxLength,
} from 'class-validator';

/**
 * Sent by the CLI to start a device login. All fields are shown to the user
 * on the approval page so they can recognise the machine.
 */
export class CreateDeviceAuthorizationDto {
    @ApiProperty({
        description: 'Host name of the machine running the CLI',
        example: 'anymal-d-042',
        required: false,
    })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    hostname?: string;

    @ApiProperty({
        description: 'Operating system of the machine running the CLI',
        example: 'Linux',
        required: false,
    })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    platform?: string;

    @ApiProperty({
        description: 'Version of the CLI',
        example: '0.67.0',
        required: false,
    })
    @IsOptional()
    @IsString()
    @MaxLength(64)
    cliVersion?: string;
}

export class DeviceAuthorizationDto {
    @ApiProperty({
        description:
            'Secret the CLI uses to poll for the tokens. Never shown to the user.',
    })
    @IsString()
    deviceCode!: string;

    @ApiProperty({
        description: 'Short code the user confirms in the browser',
        example: 'KQMX-7TRB',
    })
    @IsString()
    userCode!: string;

    @ApiProperty({
        description: 'Page where the user enters the code',
        example: 'https://datasets.example.org/cli/activate',
    })
    @IsString()
    verificationUri!: string;

    @ApiProperty({
        description: 'Same page with the code already filled in',
        example: 'https://datasets.example.org/cli/activate?code=KQMX-7TRB',
    })
    @IsString()
    verificationUriComplete!: string;

    @ApiProperty({ description: 'Seconds until the codes expire' })
    @IsInt()
    expiresIn!: number;

    @ApiProperty({ description: 'Seconds the CLI waits between polls' })
    @IsInt()
    interval!: number;
}

export class DeviceTokenRequestDto {
    @ApiProperty({ description: 'The device code from the authorization' })
    @IsString()
    @MaxLength(256)
    deviceCode!: string;
}

export const DEVICE_AUTHORIZATION_STATES = [
    'pending',
    'approved',
    'denied',
] as const;
export type DeviceAuthorizationState =
    (typeof DEVICE_AUTHORIZATION_STATES)[number];

/**
 * Result of a poll. `status` is `approved` exactly when the tokens are set.
 * `slow_down` asks the CLI to wait longer between polls.
 */
export class DeviceTokenDto {
    @ApiProperty({
        enum: ['pending', 'slow_down', 'approved', 'denied', 'expired'],
    })
    @IsIn(['pending', 'slow_down', 'approved', 'denied', 'expired'])
    status!: 'pending' | 'slow_down' | 'approved' | 'denied' | 'expired';

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    authToken?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    refreshToken?: string;
}

/**
 * What the approval page shows about a pending device login.
 */
export class DeviceAuthorizationInfoDto {
    @ApiProperty({ example: 'KQMX-7TRB' })
    @IsString()
    userCode!: string;

    @ApiProperty({ enum: DEVICE_AUTHORIZATION_STATES })
    @IsIn(DEVICE_AUTHORIZATION_STATES)
    status!: DeviceAuthorizationState;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    hostname?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    platform?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    cliVersion?: string;

    @ApiProperty()
    @IsDate()
    createdAt!: Date;

    @ApiProperty()
    @IsDate()
    expiresAt!: Date;
}
