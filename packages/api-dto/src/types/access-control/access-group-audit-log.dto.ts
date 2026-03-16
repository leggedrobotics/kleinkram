import { AccessGroupEventType } from '@kleinkram/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
    IsDate,
    IsEnum,
    IsObject,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';
import { UserDto } from '../user/user.dto';

export class AccessGroupAuditLogDto {
    @Expose()
    @ApiProperty()
    @IsString()
    uuid!: string;

    @Expose()
    @ApiProperty()
    @IsDate()
    createdAt!: Date;

    @Expose()
    @ApiProperty({ enum: AccessGroupEventType })
    @IsEnum(AccessGroupEventType)
    type!: AccessGroupEventType;

    @Expose()
    @ApiProperty()
    @IsObject()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    details!: Record<string, any>;

    @Expose()
    @ApiPropertyOptional({ type: () => UserDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => UserDto)
    actor?: UserDto;
}
