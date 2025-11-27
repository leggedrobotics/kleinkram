import { UserDto } from '@common/api/types/user/user.dto';
import { AccessGroupRights } from '@common/frontend_shared/enum';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsDate,
    IsEnum,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';

export class ActionTemplateDto {
    @ApiProperty()
    @IsUUID()
    uuid!: string;

    @ApiProperty()
    @IsDate()
    createdAt!: Date;

    @ApiProperty()
    @IsString()
    name!: string;

    @ApiProperty()
    @IsString()
    description!: string;

    @ApiProperty()
    @IsBoolean()
    archived!: boolean;

    @ApiProperty()
    @IsString()
    imageName!: string;

    @ApiProperty()
    @IsString()
    command!: string;

    @ApiProperty()
    @IsString()
    entrypoint!: string;

    @ApiProperty()
    @IsEnum(AccessGroupRights)
    accessRights!: AccessGroupRights;

    @ApiProperty()
    @IsNumber()
    gpuMemory!: number;

    @ApiProperty()
    @IsNumber()
    cpuMemory!: number;

    @ApiProperty()
    @IsNumber()
    cpuCores!: number;

    @ApiProperty()
    @IsString()
    version!: string;

    @ApiProperty()
    @IsNumber()
    maxRuntime!: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @ValidateNested()
    @Type(() => UserDto)
    creator?: UserDto | undefined;

    @ApiProperty()
    @IsNumber()
    executionCount!: number;
}
