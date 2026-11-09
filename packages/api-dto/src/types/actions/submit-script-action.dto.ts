import { MAX_ACTION_SCRIPT_BYTES } from '@kleinkram/shared';
import { ApiProperty } from '@nestjs/swagger';
import {
    IsNumber,
    IsOptional,
    IsString,
    Matches,
    Max,
    MaxLength,
    Min,
    MinLength,
} from 'class-validator';

/**
 * Filenames accepted for a submitted script.
 *
 * The name is only used to label the stored object and to make the run
 * readable; it never becomes a path, so it is restricted to a flat `.py` name
 * with no separators.
 */
const SCRIPT_FILENAME_PATTERN = /^[\w.-]{1,96}\.py$/;

/**
 * What `klein action run-script` sends: the script itself, plus where to run it.
 *
 * There is no `templateUUID` here. Script actions always run on the shared,
 * admin-managed `script-runner` template, which the backend resolves by name.
 */
export class SubmitScriptActionDto {
    @ApiProperty({ description: 'Mission the script should run on.' })
    @IsString()
    missionUUID!: string;

    @ApiProperty({
        description:
            'The Python source to run, as UTF-8 text. The byte length is capped, see MAX_ACTION_SCRIPT_BYTES.',
    })
    @IsString()
    @MinLength(1)
    // `MaxLength` counts UTF-16 code units, which is a cheap upper bound that
    // keeps a pathological body from reaching the service; the exact byte
    // limit is enforced there.
    @MaxLength(MAX_ACTION_SCRIPT_BYTES)
    script!: string;

    @ApiProperty({
        description:
            'Name of the file the script came from, used to label the run.',
    })
    @IsString()
    @Matches(SCRIPT_FILENAME_PATTERN, {
        message:
            'filename must be a plain .py file name without path separators',
    })
    filename!: string;

    @ApiProperty({
        required: false,
        description:
            'Runtime budget in hours. May only lower the budget the template allows, never raise it.',
    })
    @IsOptional()
    @IsNumber()
    @Min(1 / 60)
    @Max(24)
    maxRuntimeHours?: number;
}
