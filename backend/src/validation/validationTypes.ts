import {
    ArrayNotEmpty,
    IsArray,
    IsNotEmpty,
    IsNumber,
    IsString,
    IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsNoValidUUID, IsValidName } from './property-decorator';

export class UUIDValidate {
    @IsUUID()
    value: any;
}

export class StringValidate {
    @IsString()
    @IsNotEmpty()
    value: any;
}

export class NameValidate {
    @IsString()
    @IsNotEmpty()
    @IsValidName()
    @IsNoValidUUID()
    value!: string;
}

export class StringArrayValidate {
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    @IsNotEmpty({ each: true })
    value!: string[];
}

export class BooleanValidate {
    @Type(() => Boolean)
    value!: boolean;
}

export class DateStringValidate {
    @IsNotEmpty()
    @Type(() => Date)
    value!: Date;
}

export class NumberValidate {
    @IsNumber()
    @IsNotEmpty()
    @Type(() => Number)
    value!: number;
}
