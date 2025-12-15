import { ActionState } from '@kleinkram/shared';
import { IsSkip } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

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
    @IsSkip()
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

    @ApiProperty()
    @IsOptional()
    @IsString({ each: true })
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
