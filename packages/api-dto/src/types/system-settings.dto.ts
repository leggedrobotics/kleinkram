import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, ValidateIf } from 'class-validator';

/** Instance-wide settings, readable by every signed-in user. */
export class SystemSettingsDto {
    @ApiProperty({
        description:
            'Whether the Foxglove preview tab is shown in missions. Signed Foxglove links are not affected.',
    })
    @IsBoolean()
    foxglovePreviewEnabled!: boolean;
}

/**
 * A boolean that may be left out, but must be `true` or `false` when sent.
 *
 * The value is kept as sent: the global validation pipe converts types
 * implicitly, which would turn the string "false" into `true`. Only a missing
 * field skips the check; `@IsOptional()` would also let `null` through.
 */
export const IsOptionalStrictBoolean = (): PropertyDecorator => {
    const keepRawValue = Transform(
        ({ obj, key }) => (obj as Record<string, unknown>)[key],
    );
    const skipIfMissing = ValidateIf(
        (_object: unknown, value: unknown) => value !== undefined,
    );
    const isBoolean = IsBoolean();
    return (target: object, propertyKey: string | symbol): void => {
        keepRawValue(target, propertyKey);
        skipIfMissing(target, propertyKey);
        isBoolean(target, propertyKey);
    };
};

/** Changes to the instance-wide settings; omitted fields stay as they are. */
export class UpdateSystemSettingsDto {
    @ApiProperty({ required: false })
    @IsOptionalStrictBoolean()
    foxglovePreviewEnabled?: boolean;
}
