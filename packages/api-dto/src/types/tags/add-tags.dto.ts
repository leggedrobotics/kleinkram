import { ApiProperty } from '@nestjs/swagger';
import {
    IsBoolean,
    IsObject,
    IsOptional,
    registerDecorator,
    ValidationArguments,
} from 'class-validator';

export function IsAtLeastOnePresent(
    fields: string[],
): (target: new (...args: unknown[]) => unknown) => void {
    return function (target: new (...args: unknown[]) => unknown) {
        registerDecorator({
            name: 'isAtLeastOnePresent',
            target: target,
            propertyName: '',
            constraints: [fields],
            validator: {
                validate(_value: unknown, args: ValidationArguments) {
                    const [relatedFields] = args.constraints as [string[]];
                    const object = args.object as
                        | Record<string, unknown>
                        | undefined;
                    return relatedFields.some(
                        (field) =>
                            object?.[field] !== undefined &&
                            object[field] !== null,
                    );
                },
                defaultMessage(args: ValidationArguments) {
                    const [relatedFields] = args.constraints as [string[]];
                    return `At least one of the following fields must be present: ${relatedFields.join(', ')}`;
                },
            },
        });
    };
}

@IsAtLeastOnePresent(['metadata', 'tags'])
export class AddTagsRequestDto {
    @ApiProperty({
        description: 'Metadata key-value pairs',
        required: false,
        type: Object,
    })
    @IsOptional()
    @IsObject()
    metadata?: Record<string, string>;

    @ApiProperty({
        description: 'Tags key-value pairs',
        required: false,
        type: Object,
    })
    @IsOptional()
    @IsObject()
    tags?: Record<string, string>;
}

export class AddTagsDto {
    @ApiProperty({
        description: 'Indicates the operation was successful',
        example: true,
        type: Boolean,
    })
    @IsBoolean()
    success!: boolean;
}

export class AddTagDto {
    @ApiProperty({
        description: 'Indicates the operation was successful',
        example: true,
        type: Boolean,
    })
    @IsBoolean()
    success!: boolean;
}
