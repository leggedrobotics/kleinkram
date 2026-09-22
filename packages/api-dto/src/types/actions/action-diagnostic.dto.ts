import { DiagnosticSeverity } from '@kleinkram/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsDate,
    IsEnum,
    IsInt,
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    ValidateNested,
} from 'class-validator';

/**
 * What an action container sends when it reports a finding about itself.
 */
export class CreateActionDiagnosticDto {
    @ApiProperty({
        enum: DiagnosticSeverity,
        description:
            'How serious the finding is. WARNING and ERROR raise the severity of the action, INFO does not.',
    })
    @IsEnum(DiagnosticSeverity)
    severity!: DiagnosticSeverity;

    @ApiProperty({
        description: 'What the reader of the action needs to know.',
    })
    @IsString()
    @MaxLength(500)
    message!: string;

    @ApiProperty({
        required: false,
        description:
            'Stable identifier used to group repeated findings, e.g. MISSING_TF.',
    })
    @IsOptional()
    @IsString()
    @MaxLength(64)
    code?: string;

    @ApiProperty({
        required: false,
        description: 'The file, path or topic the finding is about.',
    })
    @IsOptional()
    @IsString()
    @MaxLength(1024)
    file?: string;

    @ApiProperty({
        required: false,
        description: 'Structured context for the finding.',
    })
    @IsOptional()
    @IsObject()
    details?: Record<string, unknown>;
}

export class ActionDiagnosticDto {
    @ApiProperty()
    @IsUUID()
    uuid!: string;

    @ApiProperty({ enum: DiagnosticSeverity })
    @IsEnum(DiagnosticSeverity)
    severity!: DiagnosticSeverity;

    @ApiProperty()
    @IsString()
    message!: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    code?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    file?: string;

    @ApiProperty({
        description:
            'How many times this exact diagnostic was reported by the action.',
    })
    @IsInt()
    count!: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsObject()
    details?: Record<string, unknown>;

    @ApiProperty()
    @IsDate()
    createdAt!: Date;
}

export class ActionDiagnosticsDto {
    @ApiProperty({ type: () => [ActionDiagnosticDto] })
    @ValidateNested({ each: true })
    @Type(() => ActionDiagnosticDto)
    data!: ActionDiagnosticDto[];

    @ApiProperty({
        description:
            'Total number of reports, counting repeats folded into a single entry.',
    })
    @IsInt()
    count!: number;

    @ApiProperty({
        description:
            'True when the action hit the per-action diagnostic cap and later reports were dropped.',
    })
    truncated!: boolean;
}
