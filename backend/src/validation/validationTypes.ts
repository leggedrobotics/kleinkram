import {
    ArrayNotEmpty,
    IsArray,
    IsBoolean,
    IsDateString,
    IsNotEmpty,
    IsString,
    IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UUIDValidate {
    @IsUUID()
    value: any;
}

export class StringValidate {
    @IsString()
    @IsNotEmpty()
    value: any;
}

export class StringArrayValidate {
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    @IsNotEmpty({ each: true })
    value: string[];
}

export class BooleanValidate {
    @IsBoolean()
    @Type(() => Boolean)
    value: boolean;
}

export class DateStringValidate {
    @IsDateString()
    @IsNotEmpty()
    @Type(() => Date)
    value: Date;
}
