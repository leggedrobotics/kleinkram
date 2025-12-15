import { Type } from 'class-transformer';
import {
    ArrayNotEmpty,
    IsArray,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsString,
    IsUUID,
} from 'class-validator';
import { IsNoValidUUID, IsValidName } from './property-decorator';
import { IsRecordStringString } from './record-validation';
import { IsSkip } from './skip-validation';
import { IsTake } from './take-validation';

export class RecordStringStringValidate {
    @IsRecordStringString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any;
}

export class SkipValidate {
    @IsSkip()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any;
}

export class TakeValidate {
    @IsTake()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any;
}

export class UUIDValidate {
    @IsUUID()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any;
}

export class StringValidate {
    @IsString()
    @IsNotEmpty()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any;
}

import { FileSource } from '@kleinkram/shared';

export class OptionalStringValidate {
    @IsString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any;
}

export class SourceValidate {
    @IsEnum(FileSource)
    value!: FileSource;
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

export class UUIDArrayValidate {
    @IsArray()
    @ArrayNotEmpty()
    @IsUUID(undefined, { each: true })
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
