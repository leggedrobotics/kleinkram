import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

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
 * Keeps the value as sent. The global validation pipe converts types
 * implicitly, which would turn the string "false" into `true`.
 */
export const KeepRawValue = (): PropertyDecorator =>
    Transform(({ obj, key }) => (obj as Record<string, unknown>)[key]);

/** Changes to the instance-wide settings; omitted fields stay as they are. */
export class UpdateSystemSettingsDto {
    @ApiProperty({ required: false })
    @KeepRawValue()
    @IsOptional()
    @IsBoolean()
    foxglovePreviewEnabled?: boolean;
}
