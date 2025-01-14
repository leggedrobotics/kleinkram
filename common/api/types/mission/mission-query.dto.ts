import { ProjectQueryDto } from '../project/project-query.dto';
import {
    IsArray,
    IsNotEmptyObject,
    ArrayNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ValidateBy, ValidationOptions, buildMessage } from 'class-validator';

function isRecordStringString(value: unknown): boolean {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    return Object.entries(value).every(
        ([key, val]) => typeof key === 'string' && typeof val === 'string',
    );
}

export function IsRecordStringString(
    validationOptions?: ValidationOptions,
): PropertyDecorator {
    return ValidateBy({
        name: 'IsRecordStringString',
        constraints: [],
        validator: {
            validate: (value: unknown, _): boolean =>
                isRecordStringString(value),
            defaultMessage: buildMessage(
                (eachPrefix) =>
                    eachPrefix +
                    '$property must be a record of string key-value pairs',
                validationOptions,
            ),
        },
    });
}

export class MissionQueryDto extends ProjectQueryDto {
    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayNotEmpty()
    @IsUUID('4', { each: true })
    missionUuids?: string[];

    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    missionPatterns?: string[];

    @IsOptional()
    @IsNotEmptyObject()
    @IsRecordStringString()
    metadata?: Record<string, string>;
}
