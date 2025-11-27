import { Type } from 'class-transformer';
import {
    IsArray,
    IsDate,
    IsEnum,
    IsNumber,
    IsObject,
    IsOptional,
    IsUUID,
    ValidateNested,
} from 'class-validator';
import { FileEventType } from '../../../frontend_shared/enum';
import { UserDto } from '../user/user.dto';

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
}

export class FileEventsDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => FileEventDto)
    data!: FileEventDto[];

    @IsNumber()
    count!: number;
}
