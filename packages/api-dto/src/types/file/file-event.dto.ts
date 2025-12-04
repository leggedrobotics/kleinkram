import { UserDto } from '@api-dto/user/user.dto';
import { FileEventType } from '@kleinkram/shared';
import { Type } from 'class-transformer';
import {
    IsArray,
    IsDate,
    IsEnum,
    IsNumber,
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';

export class FileEventActionDto {
    @IsUUID()
    uuid!: string;

    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @ValidateNested()
    @Type(() => UserDto)
    creator?: UserDto;
}

export class FileEventFileDto {
    @IsUUID()
    uuid!: string;

    @IsString()
    filename!: string;

    @IsUUID()
    missionUuid!: string;

    @IsString()
    missionName!: string;

    @IsUUID()
    projectUuid!: string;

    @IsString()
    projectName!: string;
}

export class FileEventDto {
    @IsUUID()
    uuid!: string;

    @IsEnum(FileEventType)
    type!: FileEventType;

    @IsDate()
    @Type(() => Date)
    createdAt!: Date;

    @IsObject()
    details!: Record<string, any>;

    @IsOptional()
    @ValidateNested()
    @Type(() => UserDto)
    actor?: UserDto;

    @IsOptional()
    @ValidateNested()
    @Type(() => FileEventActionDto)
    action?: FileEventActionDto;

    @IsOptional()
    @ValidateNested()
    @Type(() => FileEventFileDto)
    file?: FileEventFileDto;
}

export class FileEventsDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => FileEventDto)
    data!: FileEventDto[];

    @IsNumber()
    count!: number;
}
