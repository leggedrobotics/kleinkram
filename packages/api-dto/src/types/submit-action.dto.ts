import { ActionState } from '@kleinkram/shared';
import { IsSkip, IsTake } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';

export class SubmitActionMulti {
    @IsString({ each: true })
    missionUUIDs!: string[];

    @IsUUID()
    templateUUID!: string;
}

export class ActionQuery {
    @ApiProperty()
    @IsOptional()
    @IsUUID()
    missionUuid?: string | undefined;

    @ApiProperty()
    @IsOptional()
    @IsUUID()
    projectUuid?: string | undefined;

    @ApiProperty()
    @IsOptional()
    @IsSkip()
    @Type(() => Number)
    skip?: number | undefined;

    @ApiProperty()
    @IsOptional()
    @IsTake()
    @Type(() => Number)
    take?: number | undefined;

    @ApiProperty()
    @IsOptional()
    @IsString()
    sortBy?: string | undefined;

    @ApiProperty()
    @IsOptional()
    @IsString()
    sortDirection?: string | undefined;

    @ApiProperty()
    @IsOptional()
    @IsString()
    search?: string | undefined;

    @ApiProperty()
    @IsOptional()
    @IsBoolean()
    exactMatch?: boolean | undefined;

    @ApiProperty({ enum: ActionState, isArray: true, required: false })
    @IsOptional()
    // `?states=DONE` arrives as a string, `?states=DONE&states=FAILED` and
    // `?states[]=DONE` as an array: accept both, and split `DONE,FAILED`
    @Transform(({ value }: { value: unknown }) =>
        typeof value === 'string'
            ? value
                  .split(',')
                  .map((state) => state.trim())
                  .filter((state) => state !== '')
            : value,
    )
    @IsArray()
    @IsEnum(ActionState, {
        each: true,
        message: `states must be one or more of ${Object.values(ActionState).join(', ')}`,
    })
    states?: ActionState[] | undefined;

    @ApiProperty()
    @IsOptional()
    @IsString()
    templateName?: string | undefined;
}

export class ActionDetailsQuery {
    @IsUUID()

    // eslint-disable-next-line @typescript-eslint/naming-convention
    action_uuid!: string;
}
