import { SessionKind } from '@kleinkram/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsDate,
    IsEnum,
    IsOptional,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';

/** One login of the current user, in the web app or the CLI. */
export class SessionDto {
    @ApiProperty()
    @IsUUID()
    uuid!: string;

    @ApiProperty({ enum: SessionKind })
    @IsEnum(SessionKind)
    kind!: SessionKind;

    @ApiProperty({
        required: false,
        description: 'Browser or host name',
        example: 'anymal-d-042',
    })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiProperty({ required: false, example: 'Linux x86_64' })
    @IsOptional()
    @IsString()
    platform?: string;

    @ApiProperty({ required: false, example: '0.67.0' })
    @IsOptional()
    @IsString()
    clientVersion?: string;

    @ApiProperty()
    @IsDate()
    createdAt!: Date;

    @ApiProperty({ description: 'Last time the session was refreshed' })
    @IsDate()
    lastUsedAt!: Date;

    @ApiProperty({
        description:
            'When the session ends unless it is used again (idle or absolute limit, whichever comes first)',
    })
    @IsDate()
    expiresAt!: Date;

    @ApiProperty({ description: 'Whether this request uses the session' })
    @IsBoolean()
    current!: boolean;
}

export class SessionsDto {
    @ApiProperty({ type: [SessionDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SessionDto)
    sessions!: SessionDto[];
}
