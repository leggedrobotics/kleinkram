import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/**
 * The Python file a script action ran, read back for display.
 *
 * Scripts are small by construction (capped at 1 MiB on submit), so the body is
 * returned inline rather than as a download link.
 */
export class ActionScriptDto {
    @ApiProperty({
        description: 'Name of the file as it was submitted',
        example: 'analyse.py',
    })
    @IsString()
    filename!: string;

    @ApiProperty({
        description: 'Verbatim contents of the submitted script',
    })
    @IsString()
    content!: string;
}
